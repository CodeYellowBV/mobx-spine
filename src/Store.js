import { observable, computed, action } from 'mobx';
import { isArray, map, filter, find, keyBy, at } from 'lodash';
import request from './request';

export default class Store {
    // Holds all models
    @observable models = [];
    // Holds the fetch parameters
    @observable params = {};
    @observable __pendingRequestCount = 0;
    @observable __state = {
        currentPage: 1,
        limit: 25,
        totalRecords: 0,
    };
    __activeRelations = [];
    Model = null;
    __repository;

    @computed get isLoading() {
        return this.__pendingRequestCount > 0;
    }

    @computed get length() {
        return this.models.length;
    }

    constructor(data, options = {}) {
        if (options.relations) {
            this.__parseRelations(options.relations);
        }
        // TODO: throw an error if it's not an array?
        if (data) {
            this.parse(data);
        }
        if (options.currentPage !== undefined) {
            this.setPage(options.currentPage, { fetch: false });
        }
        if (options.limit !== undefined) {
            this.setLimit(options.limit);
        }
    }

    __parseRelations(activeRelations) {
        this.__activeRelations = activeRelations;
    }

    __addFromRepository(ids = []) {
        ids = isArray(ids) ? ids : [ids];

        const records = at(keyBy(this.__repository, 'id'), ids);
        this.models.replace(records.map((record) => {
            return new this.Model(record, {
                store: this,
                // TODO: fix nested relations in stores.
                // This only does not work when using e.g. `owners.location`
                // (where `owners` is a store, and `location` a model)
            });
        }));
    }

    buildParams() {
        const offset = this.getPageOffset();
        return {
            with: this.__activeRelations.join(',') || null,
            limit: this.__state.limit,
            // Hide offset if zero so the request looks cleaner in DevTools.
            offset: offset || null,
        };
    }

    @action fromBackend({ data, repos, relMapping }) {
        this.models.replace(data.map((record) => {
            // TODO: I'm not happy at all about how this looks.
            // We'll need to finetune some things, but hey, for now it works.
            const model = this._newModel();
            model.fromBackend({
                data: record,
                repos,
                relMapping,
            });
            return model;
        }));
    }

    _newModel(model = null) {
        return new this.Model(model, {
            store: this,
            relations: this.__activeRelations,
        });
    }

    @action parse(models) {
        this.models.replace(models.map(this._newModel.bind(this)));
    }

    @action add(models) {
        const singular = !isArray(models);
        models = singular ? [models] : models.slice();

        const modelInstances = models.map(this._newModel.bind(this));

        modelInstances.forEach(modelInstance => this.models.push(modelInstance));

        return singular ? modelInstances[0] : modelInstances;
    }

    @action remove(models) {
        const singular = !isArray(models);
        models = singular ? [models] : models.slice();

        models.forEach(model => this.models.remove(model));

        return models;
    }

    @action clear() {
        this.models.clear();
    }

    @action fetch(options = {}) {
        this.__pendingRequestCount += 1;
        const params = Object.assign(this.buildParams(), this.params, options.data);
        return request.get(this.url, params)
        .then(action((res) => {
            this.__pendingRequestCount -= 1;
            this.__state.totalRecords = res.meta.total_records;
            this.fromBackend({
                data: res.data,
                repos: res.with,
                relMapping: res.with_mapping,
            });
        }));
    }

    toJS() {
        return this.models.map(model => model.toJS());
    }

    // Methods for pagination.

    getPageOffset() {
        return (this.__state.currentPage - 1) * this.__state.limit;
    }

    @action setLimit(limit) {
        if (limit && !Number.isInteger(limit)) {
            throw new Error('Page limit should be a number or falsy value.');
        }
        this.__state.limit = limit || null;
    }

    @computed get totalPages() {
        if (!this.__state.limit) {
            return 0;
        }
        return Math.ceil(this.__state.totalRecords / this.__state.limit);
    }

    @computed get currentPage() {
        return this.__state.currentPage;
    }

    @computed get hasNextPage() {
        return this.__state.currentPage + 1 <= this.totalPages;
    }

    @computed get hasPreviousPage() {
        return this.__state.currentPage > 1;
    }

    @action getNextPage() {
        if (!this.hasNextPage) {
            throw new Error('There is no next page.');
        }
        this.__state.currentPage += 1;
        return this.fetch();
    }

    @action getPreviousPage() {
        if (!this.hasPreviousPage) {
            throw new Error('There is no previous page.');
        }
        this.__state.currentPage -= 1;
        return this.fetch();
    }

    @action setPage(page = 1, options = {}) {
        if (!Number.isInteger(page)) {
            throw new Error('Page should be a number.');
        }
        if (page > this.totalPages || page < 1) {
            throw new Error(`Page should be between 1 and ${this.totalPages}.`);
        }
        this.__state.currentPage = page;
        if (options.fetch === undefined || options.fetch) {
            return this.fetch();
        }
        return Promise.resolve();
    }

    // Helper methods to read models.

    get(id) {
        // The id can be defined as a string or int, but we want it to work in both cases.
        return this.models.find(model => model[model.primaryKey] == id); // eslint-disable-line eqeqeq
    }

    map(predicate) {
        return map(this.models, predicate);
    }

    filter(predicate) {
        return filter(this.models, predicate);
    }

    find(predicate) {
        return find(this.models, predicate);
    }

    each(predicate) {
        return this.models.forEach(predicate);
    }

    at(index) {
        if (index < 0) {
            index += this.length;
        }
        return this.models[index];
    }
}
