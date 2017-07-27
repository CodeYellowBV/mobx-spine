import { observable, computed, action, autorun } from 'mobx';
import {
    isArray,
    map,
    filter,
    find,
    sortBy,
    forIn,
    omit,
    isPlainObject,
    result,
    uniqBy,
} from 'lodash';
import { invariant } from './utils';

const AVAILABLE_CONST_OPTIONS = [
    'relations',
    'limit',
    'comparator',
    'repository',
];

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
    api = null;
    __repository;
    static backendResourceName = '';

    url() {
        // Try to auto-generate the URL.
        const bname = this.constructor.backendResourceName;
        if (bname) {
            return `/${bname}/`;
        }
        return null;
    }

    @computed
    get isLoading() {
        return this.__pendingRequestCount > 0;
    }

    @computed
    get length() {
        return this.models.length;
    }

    set backendResourceName(v) {
        invariant(
            false,
            '`backendResourceName` should be a static property on the store.'
        );
    }

    // Empty function, but can be overridden if you want to do something after initializing the model.
    initialize() {}

    constructor(options = {}) {
        invariant(
            isPlainObject(options),
            'Store only accepts an object with options. Chain `.parse(data)` to add models.'
        );
        forIn(options, (value, option) => {
            invariant(
                AVAILABLE_CONST_OPTIONS.includes(option),
                `Unknown option passed to store: ${option}`
            );
        });
        this.__repository = options.repository;
        if (options.relations) {
            this.__parseRelations(options.relations);
        }
        if (options.limit !== undefined) {
            this.setLimit(options.limit);
        }
        if (options.comparator) {
            this.comparator = options.comparator;
        }
        this.initialize();
    }

    __parseRelations(activeRelations) {
        this.__activeRelations = activeRelations;
    }

    __getApi() {
        invariant(
            this.api,
            'You are trying to perform a API request without an `api` property defined on the store.'
        );
        invariant(
            result(this, 'url'),
            'You are trying to perform a API request without an `url` property defined on the store.'
        );
        return this.api;
    }

    @action
    fromBackend({ data, repos, relMapping }) {
        this.models.replace(
            data.map(record => {
                // TODO: I'm not happy at all about how this looks.
                // We'll need to finetune some things, but hey, for now it works.
                const model = this._newModel();
                model.fromBackend({
                    data: record,
                    repos,
                    relMapping,
                });
                return model;
            })
        );
        this.sort();
    }

    _newModel(model = null) {
        return new this.Model(model, {
            store: this,
            relations: this.__activeRelations,
        });
    }

    @action
    sort(options = {}) {
        invariant(
            isPlainObject(options),
            'Expecting a plain object for options.'
        );
        if (!this.comparator) {
            return this;
        }
        if (typeof this.comparator === 'string') {
            this.models.replace(this.sortBy(this.comparator));
        } else {
            this.models.replace(this.models.sort(this.comparator));
        }
        return this;
    }

    @action
    parse(models) {
        invariant(
            isArray(models),
            `Parameter supplied to \`parse()\` is not an array, got: ${JSON.stringify(
                models
            )}`
        );
        this.models.replace(models.map(this._newModel.bind(this)));
        this.sort();

        return this;
    }

    parseValidationErrors(valErrors) {
        this.each(model => {
            model.parseValidationErrors(valErrors);
        });
    }

    clearValidationErrors() {
        this.each(model => {
            model.clearValidationErrors();
        });
    }

    @action
    add(models) {
        const singular = !isArray(models);
        models = singular ? [models] : models.slice();

        const modelInstances = models.map(this._newModel.bind(this));

        modelInstances.forEach(modelInstance => {
            const primaryValue = modelInstance[this.Model.primaryKey];
            invariant(
                !primaryValue || !this.get(primaryValue),
                `A model with the same primary key value "${primaryValue}" already exists in this store.`
            );
            this.models.push(modelInstance);
        });
        this.sort();

        return singular ? modelInstances[0] : modelInstances;
    }

    @action
    remove(models) {
        const singular = !isArray(models);
        models = singular ? [models] : models.slice();

        models.forEach(model => this.models.remove(model));

        return models;
    }

    @action
    removeById(ids) {
        const singular = !isArray(ids);
        ids = singular ? [ids] : ids.slice();
        invariant(
            !ids.some(isNaN),
            `Cannot remove a model by id that is not a number: ${JSON.stringify(
                ids
            )}`
        );

        const models = ids.map(id => this.get(id));

        models.forEach(model => {
            if (model) {
                this.models.remove(model);
            }
        });

        return models;
    }

    @action
    clear() {
        this.models.clear();
    }

    @action
    fetch(options = {}) {
        this.__pendingRequestCount += 1;
        const data = Object.assign(
            this.__getApi().buildFetchStoreParams(this),
            this.params,
            options.data
        );
        return this.__getApi()
            .fetchStore({
                url: result(this, 'url'),
                data,
                requestOptions: omit(options, 'data'),
            })
            .then(
                action(res => {
                    this.__pendingRequestCount -= 1;
                    this.__state.totalRecords = res.totalRecords;
                    this.fromBackend(res);
                })
            );
    }

    toJS() {
        return this.models.map(model => model.toJS());
    }

    // Methods for pagination.

    getPageOffset() {
        return (this.__state.currentPage - 1) * this.__state.limit;
    }

    @action
    setLimit(limit) {
        invariant(
            !limit || Number.isInteger(limit),
            'Page limit should be a number or falsy value.'
        );
        this.__state.limit = limit || null;
    }

    @computed
    get totalPages() {
        if (!this.__state.limit) {
            return 0;
        }
        return Math.ceil(this.__state.totalRecords / this.__state.limit);
    }

    @computed
    get currentPage() {
        return this.__state.currentPage;
    }

    @computed
    get hasNextPage() {
        return this.__state.currentPage + 1 <= this.totalPages;
    }

    @computed
    get hasPreviousPage() {
        return this.__state.currentPage > 1;
    }

    @action
    getNextPage() {
        invariant(this.hasNextPage, 'There is no next page.');
        this.__state.currentPage += 1;
        return this.fetch();
    }

    @action
    getPreviousPage() {
        invariant(this.hasPreviousPage, 'There is no previous page.');
        this.__state.currentPage -= 1;
        return this.fetch();
    }

    @action
    setPage(page = 1, options = {}) {
        invariant(Number.isInteger(page), 'Page should be a number.');
        this.__state.currentPage = page;
        if (options.fetch === undefined || options.fetch) {
            return this.fetch();
        }
        invariant(
            page <= this.totalPages && page >= 1,
            `Page should be between 1 and ${this.totalPages}.`
        );
        return Promise.resolve();
    }

    toBackendAll(newIds = [], options = {}) {
        const modelData = this.models.map((model, i) => {
            return model.toBackendAll(
                newIds && newIds[i] !== undefined ? newIds[i] : null,
                { relations: options.relations }
            );
        });

        let data = [];
        const relations = {};

        modelData.forEach(model => {
            data = data.concat(model.data);
            forIn(model.relations, (relModel, key) => {
                relations[key] = relations[key]
                    ? relations[key].concat(relModel)
                    : relModel;
                // TODO: this primaryKey is not the primaryKey of the relation we're de-duplicating...
                relations[key] = uniqBy(relations[key], this.Model.primaryKey);
            });
        });

        return { data, relations };
    }

    // Create a new instance of this store with a predicate applied.
    // This new store will be automatically kept in-sync with all models that adhere to the predicate.
    virtualStore({ filter, comparator }) {
        const store = new this.constructor({
            relations: this.__activeRelations,
            comparator,
        });
        // Oh gawd MobX is so awesome.
        const events = autorun(() => {
            const models = this.filter(filter);
            store.models.replace(models);
            store.sort();
        });
        store.unsubscribeVirtualStore = events;
        return store;
    }

    // Helper methods to read models.

    get(id) {
        // The id can be defined as a string or int, but we want it to work in both cases.
        return this.models.find(
            model => model[model.constructor.primaryKey] == id // eslint-disable-line eqeqeq
        );
    }

    getByIds(ids) {
        return this.models.filter(model => {
            const id = model[model.constructor.primaryKey];
            return ids.includes(id) || ids.includes('' + id);
        });
    }

    map(predicate) {
        return map(this.models, predicate);
    }

    mapByPrimaryKey() {
        return this.map(this.Model.primaryKey);
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

    sortBy(iteratees) {
        return sortBy(this.models, iteratees);
    }

    at(index) {
        const zeroLength = this.length - 1;
        invariant(
            index <= zeroLength,
            `Index ${index} is out of bounds (max ${zeroLength}).`
        );
        if (index < 0) {
            index += this.length;
        }
        return this.models[index];
    }
}
