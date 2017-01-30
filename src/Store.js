import { observable, computed, action } from 'mobx';
import request from './request';
import { isArray, map, filter, find, keyBy, at } from 'lodash';

export default class Store {
    // Holds all models
    @observable models = [];
    // Holds the fetch parameters
    @observable params = {};
    @observable _pendingRequestCount = 0;
    @observable _state = {
        currentPage: 1,
        limit: 25,
        totalRecords: 0,
    };
    _activeRelations = [];
    Model = null;
    _repository;

    @computed get isLoading() {
        return this._pendingRequestCount > 0;
    }

    @computed get length() {
        return this.models.length;
    }

    constructor(data, options = {}) {
        if (options.relations) {
            this.parseRelations(options.relations);
        }
        // TODO: throw an error if it's not an array?
        if (data) {
            this.replace({ data });
        }
        if (options.currentPage !== undefined) {
            this.setPage(options.currentPage, { fetch: false });
        }
        if (options.limit !== undefined) {
            this.setLimit(options.limit);
        }
    }

    parseRelations(activeRelations) {
        this._activeRelations = activeRelations;
    }

    setRepository(repository) {
        this._repository = repository;
    }

    addFromRepository(ids = []) {
        ids = isArray(ids) ? ids : [ids];

        const records = at(keyBy(this._repository, 'id'), ids);
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
            with: this._activeRelations.join(','),
            limit: this._state.limit,
            // Hide offset if zero so the request looks cleaner in DevTools.
            offset: offset || null,
        };
    }

    @action replace({ data, repos, relMapping }) {
        this.models.replace(data.map((record) => {
            // TODO: I'm not happy at all about how this looks.
            // We'll need to finetune some things, but hey, for now it works.
            const model = new this.Model(null, {
                store: this,
                relations: this._activeRelations,
            });
            model.fromBackend({
                data: record,
                repos,
                relMapping,
            });
            return model;
        }));
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
        this._pendingRequestCount += 1;
        const params = Object.assign(this.buildParams(), this.params, options.data);
        return request.get(this.url, params)
        .then(action((res) => {
            this._pendingRequestCount -= 1;
            this._state.totalRecords = res.meta.total_records;
            this.replace({
                data: res.data,
                repos: res.with,
                relMapping: res.with_mapping,
            });
        }));
    }

    // Methods for pagination.

    getPageOffset() {
        return (this._state.currentPage - 1) * this._state.limit;
    }

    @action setLimit(limit) {
        if (limit && !Number.isInteger(limit)) {
            throw new Error('Page limit should be a number or falsy value.');
        }
        this._state.limit = limit || null;
    }

    @computed get totalPages() {
        if (!this._state.limit) {
            return 0;
        }
        return Math.ceil(this._state.totalRecords / this._state.limit);
    }

    @computed get currentPage() {
        return this._state.currentPage;
    }

    @computed get hasNextPage() {
        return this._state.currentPage + 1 <= this.totalPages;
    }

    @computed get hasPreviousPage() {
        return this._state.currentPage > 1;
    }

    @action getNextPage() {
        if (!this.hasNextPage) {
            throw new Error('There is no next page.');
        }
        this._state.currentPage += 1;
        this.fetch();
    }

    @action getPreviousPage() {
        if (!this.hasPreviousPage) {
            throw new Error('There is no previous page.');
        }
        this._state.currentPage -= 1;
        this.fetch();
    }

    @action setPage(page = 1, options = {}) {
        if (!Number.isInteger(page)) {
            throw new Error('Page should be a number.');
        }
        if (page > this.totalPages || page < 1) {
            throw new Error(`Page should be between 1 and ${this.totalPages}.`);
        }
        this._state.currentPage = page;
        if (options.fetch === undefined || options.fetch) {
            this.fetch();
        }
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
