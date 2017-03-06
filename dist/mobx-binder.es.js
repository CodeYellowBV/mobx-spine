import { action, computed, extendObservable, isObservable, observable, toJS } from 'mobx';
import { at, filter, find, forIn, get, isArray, isPlainObject, keyBy, map, mapKeys, mapValues, snakeCase } from 'lodash';
import axios from 'axios';

// lodash's `camelCase` method removes dots from the string; this breaks mobx-binder
function snakeToCamel(s) {
    if (s.startsWith('_')) {
        return s;
    }
    return s.replace(/_\w/g, m => m[1].toUpperCase());
}

var _class$1;
var _descriptor$1;
var _descriptor2$1;
var _descriptor3;
var _descriptor4;

function _initDefineProp$1(target, property, descriptor, context) {
    if (!descriptor) return;
    Object.defineProperty(target, property, {
        enumerable: descriptor.enumerable,
        configurable: descriptor.configurable,
        writable: descriptor.writable,
        value: descriptor.initializer ? descriptor.initializer.call(context) : void 0
    });
}

function _applyDecoratedDescriptor$1(target, property, decorators, descriptor, context) {
    var desc = {};
    Object['ke' + 'ys'](descriptor).forEach(function (key) {
        desc[key] = descriptor[key];
    });
    desc.enumerable = !!desc.enumerable;
    desc.configurable = !!desc.configurable;

    if ('value' in desc || desc.initializer) {
        desc.writable = true;
    }

    desc = decorators.slice().reverse().reduce(function (desc, decorator) {
        return decorator(target, property, desc) || desc;
    }, desc);

    if (context && desc.initializer !== void 0) {
        desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
        desc.initializer = undefined;
    }

    if (desc.initializer === void 0) {
        Object['define' + 'Property'](target, property, desc);
        desc = null;
    }

    return desc;
}

let Store = (_class$1 = class Store {
    get isLoading() {
        return this.__pendingRequestCount > 0;
    }
    // Holds the fetch parameters
    get length() {
        return this.models.length;
    }

    constructor(data, options = {}) {
        _initDefineProp$1(this, 'models', _descriptor$1, this);

        _initDefineProp$1(this, 'params', _descriptor2$1, this);

        _initDefineProp$1(this, '__pendingRequestCount', _descriptor3, this);

        _initDefineProp$1(this, '__state', _descriptor4, this);

        this.__activeRelations = [];
        this.Model = null;
        this.api = null;

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
        this.models.replace(records.map(record => {
            return new this.Model(record, {
                store: this
            });
        }));
    }

    fromBackend({ data, repos, relMapping }) {
        this.models.replace(data.map(record => {
            // TODO: I'm not happy at all about how this looks.
            // We'll need to finetune some things, but hey, for now it works.
            const model = this._newModel();
            model.fromBackend({
                data: record,
                repos,
                relMapping
            });
            return model;
        }));
    }

    _newModel(model = null) {
        return new this.Model(model, {
            store: this,
            relations: this.__activeRelations
        });
    }

    parse(models) {
        this.models.replace(models.map(this._newModel.bind(this)));
    }

    add(models) {
        const singular = !isArray(models);
        models = singular ? [models] : models.slice();

        const modelInstances = models.map(this._newModel.bind(this));

        modelInstances.forEach(modelInstance => this.models.push(modelInstance));

        return singular ? modelInstances[0] : modelInstances;
    }

    remove(models) {
        const singular = !isArray(models);
        models = singular ? [models] : models.slice();

        models.forEach(model => this.models.remove(model));

        return models;
    }

    clear() {
        this.models.clear();
    }

    fetch(options = {}) {
        this.__pendingRequestCount += 1;
        const data = Object.assign(this.api.buildFetchStoreParams(this), this.params, options.data);
        return this.api.fetchStore({ url: this.url, data }).then(action(res => {
            this.__pendingRequestCount -= 1;
            this.__state.totalRecords = res.totalRecords;
            this.fromBackend(res);
        }));
    }

    toJS() {
        return this.models.map(model => model.toJS());
    }

    // Methods for pagination.

    getPageOffset() {
        return (this.__state.currentPage - 1) * this.__state.limit;
    }

    setLimit(limit) {
        if (limit && !Number.isInteger(limit)) {
            throw new Error('Page limit should be a number or falsy value.');
        }
        this.__state.limit = limit || null;
    }

    get totalPages() {
        if (!this.__state.limit) {
            return 0;
        }
        return Math.ceil(this.__state.totalRecords / this.__state.limit);
    }

    get currentPage() {
        return this.__state.currentPage;
    }

    get hasNextPage() {
        return this.__state.currentPage + 1 <= this.totalPages;
    }

    get hasPreviousPage() {
        return this.__state.currentPage > 1;
    }

    getNextPage() {
        if (!this.hasNextPage) {
            throw new Error('There is no next page.');
        }
        this.__state.currentPage += 1;
        return this.fetch();
    }

    getPreviousPage() {
        if (!this.hasPreviousPage) {
            throw new Error('There is no previous page.');
        }
        this.__state.currentPage -= 1;
        return this.fetch();
    }

    setPage(page = 1, options = {}) {
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
}, (_descriptor$1 = _applyDecoratedDescriptor$1(_class$1.prototype, 'models', [observable], {
    enumerable: true,
    initializer: function () {
        return [];
    }
}), _descriptor2$1 = _applyDecoratedDescriptor$1(_class$1.prototype, 'params', [observable], {
    enumerable: true,
    initializer: function () {
        return {};
    }
}), _descriptor3 = _applyDecoratedDescriptor$1(_class$1.prototype, '__pendingRequestCount', [observable], {
    enumerable: true,
    initializer: function () {
        return 0;
    }
}), _descriptor4 = _applyDecoratedDescriptor$1(_class$1.prototype, '__state', [observable], {
    enumerable: true,
    initializer: function () {
        return {
            currentPage: 1,
            limit: 25,
            totalRecords: 0
        };
    }
}), _applyDecoratedDescriptor$1(_class$1.prototype, 'isLoading', [computed], Object.getOwnPropertyDescriptor(_class$1.prototype, 'isLoading'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'length', [computed], Object.getOwnPropertyDescriptor(_class$1.prototype, 'length'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'fromBackend', [action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'fromBackend'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'parse', [action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'parse'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'add', [action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'add'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'remove', [action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'remove'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'clear', [action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'clear'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'fetch', [action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'fetch'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'setLimit', [action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'setLimit'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'totalPages', [computed], Object.getOwnPropertyDescriptor(_class$1.prototype, 'totalPages'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'currentPage', [computed], Object.getOwnPropertyDescriptor(_class$1.prototype, 'currentPage'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'hasNextPage', [computed], Object.getOwnPropertyDescriptor(_class$1.prototype, 'hasNextPage'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'hasPreviousPage', [computed], Object.getOwnPropertyDescriptor(_class$1.prototype, 'hasPreviousPage'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'getNextPage', [action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'getNextPage'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'getPreviousPage', [action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'getPreviousPage'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'setPage', [action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'setPage'), _class$1.prototype)), _class$1);

var _class;
var _descriptor;
var _descriptor2;

function _initDefineProp(target, property, descriptor, context) {
    if (!descriptor) return;
    Object.defineProperty(target, property, {
        enumerable: descriptor.enumerable,
        configurable: descriptor.configurable,
        writable: descriptor.writable,
        value: descriptor.initializer ? descriptor.initializer.call(context) : void 0
    });
}

function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
    var desc = {};
    Object['ke' + 'ys'](descriptor).forEach(function (key) {
        desc[key] = descriptor[key];
    });
    desc.enumerable = !!desc.enumerable;
    desc.configurable = !!desc.configurable;

    if ('value' in desc || desc.initializer) {
        desc.writable = true;
    }

    desc = decorators.slice().reverse().reduce(function (desc, decorator) {
        return decorator(target, property, desc) || desc;
    }, desc);

    if (context && desc.initializer !== void 0) {
        desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
        desc.initializer = undefined;
    }

    if (desc.initializer === void 0) {
        Object['define' + 'Property'](target, property, desc);
        desc = null;
    }

    return desc;
}

let Model = (_class = class Model {
    // Holds activated - non-nested - relations (e.g. `['animal']`)

    // Holds original attributes with values, so `clear()` knows what to reset to (quite ugly).
    get url() {
        const id = this[this.primaryKey];
        return `${this.urlRoot}${id ? `${id}/` : ''}`;
    }
    // Holds activated - nested - relations (e.g. `['animal', 'animal.breed']`)

    // TODO: Find out why `static primaryKey` doesn't work. I WANT IT STATIC GODDAMMIT.
    get isNew() {
        return !this[this.primaryKey];
    }

    get isLoading() {
        return this.__pendingRequestCount > 0;
    }

    constructor(data, options = {}) {
        this.primaryKey = 'id';
        this.__attributes = [];
        this.__originalAttributes = {};
        this.__activeRelations = [];
        this.__activeCurrentRelations = [];
        this.api = null;

        _initDefineProp(this, '__backendValidationErrors', _descriptor, this);

        _initDefineProp(this, '__pendingRequestCount', _descriptor2, this);

        this.__store = options.store;
        this.__repository = options.repository;
        // Find all attributes. Not all observables are an attribute.
        forIn(this, (value, key) => {
            if (!key.startsWith('__') && isObservable(this, key)) {
                this.__attributes.push(key);
                this.__originalAttributes[key] = value;
            }
        });
        if (options.relations) {
            this.__parseRelations(options.relations);
        }
        if (data) {
            this.parse(data);
        }
    }

    __parseRelations(activeRelations) {
        this.__activeRelations = activeRelations;
        // TODO: No idea why getting the relations only works when it's a Function.
        const relations = this.relations && this.relations();
        const relModels = {};
        activeRelations.forEach(aRel => {
            // Find the relation name before the first dot, and include all other relations after it
            // Example: input `animal.kind.breed` output -> `['animal', 'kind.breed']`
            const relNames = aRel.match(/([^.]+)\.(.+)/);
            const currentRel = relNames ? relNames[1] : aRel;
            const otherRelNames = relNames && relNames[2];
            const currentProp = relModels[currentRel];
            const otherRels = otherRelNames && [otherRelNames];
            // When two nested relations are defined next to each other (e.g. `['kind.breed', 'kind.location']`),
            // the relation `kind` only needs to be initialized once.
            relModels[currentRel] = currentProp ? currentProp.concat(otherRels) : otherRels;
            this.__activeCurrentRelations.push(currentRel);
        });
        extendObservable(this, mapValues(relModels, (otherRelNames, relName) => {
            const RelModel = relations[relName];
            if (!RelModel) {
                throw new Error(`Specified relation "${relName}" does not exist on model.`);
            }
            return new RelModel(null, {
                relations: otherRelNames
            });
        }));
    }

    toBackend() {
        const output = {};
        this.__attributes.forEach(attr => {
            if (!attr.startsWith('_')) {
                output[snakeCase(attr)] = toJS(this[attr]);
            }
        });
        // Add active relations as id.
        this.__activeCurrentRelations.forEach(currentRel => {
            const rel = this[currentRel];
            const relBackendName = snakeCase(currentRel);
            if (rel instanceof Model) {
                output[relBackendName] = rel[rel.primaryKey];
            }
            if (rel instanceof Store) {
                // TODO: This should use the `primaryKey` of the model in the store instead, not hardcoded the `id`.
                output[relBackendName] = rel.map('id');
            }
        });
        return output;
    }

    toJS() {
        const output = {};
        this.__attributes.forEach(attr => {
            output[attr] = toJS(this[attr]);
        });

        this.__activeCurrentRelations.forEach(currentRel => {
            const model = this[currentRel];
            if (model) {
                output[currentRel] = model.toJS();
            }
        });
        return output;
    }

    fromBackend({ data, repos, relMapping }) {
        // `data` contains properties for the current model.
        // `repos` is an object of "repositories". A repository is
        // e.g. "animal_kind", while the relation name would be "kind".
        // `relMapping` maps relation names to repositories.
        forIn(relMapping, (repoName, relName) => {
            const repository = repos[repoName];
            // All nested models get a repository. At this time we don't know yet
            // what id the model should get, since the parent may or may not be set.
            const model = get(this, snakeToCamel(relName));
            model.__repository = repository;
        });

        // Now all repositories are set on the relations, start parsing the actual data.
        // `parse()` will recursively fill in all relations.
        if (data) {
            this.parse(data);
        }
    }

    __addFromRepository(id) {
        const relData = find(this.__repository, { id });
        if (relData) {
            this.parse(relData);
        }
    }

    parse(data) {
        forIn(data, (value, key) => {
            const attr = snakeToCamel(key);
            if (this.__attributes.includes(attr)) {
                this[attr] = value;
            } else if (this.__activeCurrentRelations.includes(attr)) {
                // In Binder, a relation property is an `int` or `[int]`, referring to its ID.
                // However, it can also be an object if there are nested relations (non flattened).
                if (isPlainObject(value) || isPlainObject(get(value, '[0]'))) {
                    this[attr].parse(value);
                } else {
                    this[attr].__addFromRepository(value);
                }
            }
        });
    }

    save() {
        this.__backendValidationErrors = {};
        this.__pendingRequestCount += 1;
        // TODO: Allow data from an argument to be saved?
        return this.api.saveModel({
            url: this.url,
            data: this.toBackend(),
            isNew: !!this[this.primaryKey]
        }).then(action(data => {
            this.__pendingRequestCount -= 1;
            this.parse(data);
        })).catch(action(err => {
            this.__pendingRequestCount -= 1;
            if (err.valErrors) {
                this.__backendValidationErrors = err.valErrors;
            }
            throw err;
        }));
    }

    // TODO: This is a bit hacky...
    get backendValidationErrors() {
        return this.__backendValidationErrors;
    }

    delete() {
        // TODO: currently this always does a optimistic delete (meaning it doesn't wait on the request)
        // Do we want a non-optimistic delete?
        if (this.__store) {
            this.__store.remove(this);
        }
        if (this[this.primaryKey]) {
            this.__pendingRequestCount += 1;
            return this.api.deleteModel({ url: this.url }).then(action(() => {
                this.__pendingRequestCount -= 1;
            }));
        }
        return Promise.resolve();
    }

    fetch(options = {}) {
        // TODO: I feel like we should give a clear error message when `urlRoot` is not defined.
        if (!this[this.primaryKey]) {
            throw new Error('Trying to fetch model without id!');
        }
        this.__pendingRequestCount += 1;
        const data = Object.assign(this.api.buildFetchModelParams(this), options.data);
        return this.api.fetchModel({ url: this.url, data }).then(action(res => {
            this.fromBackend(res);
            this.__pendingRequestCount -= 1;
        }));
    }

    clear() {
        forIn(this.__originalAttributes, (value, key) => {
            this[key] = value;
        });

        this.__activeCurrentRelations.forEach(currentRel => {
            this[currentRel].clear();
        });
    }
}, (_descriptor = _applyDecoratedDescriptor(_class.prototype, '__backendValidationErrors', [observable], {
    enumerable: true,
    initializer: function () {
        return {};
    }
}), _descriptor2 = _applyDecoratedDescriptor(_class.prototype, '__pendingRequestCount', [observable], {
    enumerable: true,
    initializer: function () {
        return 0;
    }
}), _applyDecoratedDescriptor(_class.prototype, 'url', [computed], Object.getOwnPropertyDescriptor(_class.prototype, 'url'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'isNew', [computed], Object.getOwnPropertyDescriptor(_class.prototype, 'isNew'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'isLoading', [computed], Object.getOwnPropertyDescriptor(_class.prototype, 'isLoading'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, '__parseRelations', [action], Object.getOwnPropertyDescriptor(_class.prototype, '__parseRelations'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'fromBackend', [action], Object.getOwnPropertyDescriptor(_class.prototype, 'fromBackend'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'parse', [action], Object.getOwnPropertyDescriptor(_class.prototype, 'parse'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'save', [action], Object.getOwnPropertyDescriptor(_class.prototype, 'save'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'backendValidationErrors', [computed], Object.getOwnPropertyDescriptor(_class.prototype, 'backendValidationErrors'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'delete', [action], Object.getOwnPropertyDescriptor(_class.prototype, 'delete'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'fetch', [action], Object.getOwnPropertyDescriptor(_class.prototype, 'fetch'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'clear', [action], Object.getOwnPropertyDescriptor(_class.prototype, 'clear'), _class.prototype)), _class);

// Function ripped from Django docs.
// See: https://docs.djangoproject.com/en/dev/ref/csrf/#ajax
function csrfSafeMethod(method) {
    // These HTTP methods do not require CSRF protection.
    return (/^(GET|HEAD|OPTIONS|TRACE)$/i.test(method)
    );
}

function parseBackendValidationErrors(response) {
    const valErrors = get(response, 'data.error.validation_errors');
    if (response.status === 400 && valErrors) {
        const camelCasedErrors = mapKeys(valErrors, (value, key) => snakeToCamel(key));
        return mapValues(camelCasedErrors, valError => {
            return valError.map(obj => obj.code);
        });
    }
    return null;
}

let BinderApi = class BinderApi {
    constructor() {
        this.baseUrl = null;
        this.csrfToken = null;
        this.defaultHeaders = {};
    }

    __request(method, url, data, options) {
        options || (options = {});
        const useCsrfToken = csrfSafeMethod(method) ? undefined : this.csrfToken;

        const axiosOptions = {
            method,
            baseURL: this.baseUrl,
            url,
            data: method !== 'get' && data ? data : undefined,
            params: method === 'get' && data ? data : undefined,
            headers: Object.assign({
                'Content-Type': 'application/json',
                'X-Csrftoken': useCsrfToken
            }, this.defaultHeaders)
        };

        Object.assign(axiosOptions, options);

        return axios(axiosOptions).then(response => response.data);
    }

    get(url, data, options) {
        return this.__request('get', url, data, options);
    }

    post(url, data, options) {
        return this.__request('post', url, data, options);
    }

    patch(url, data, options) {
        return this.__request('patch', url, data, options);
    }

    put(url, data, options) {
        return this.__request('put', url, data, options);
    }

    delete(url, data, options) {
        return this.__request('delete', url, data, options);
    }

    buildFetchModelParams(model) {
        return {
            with: model.__activeRelations.join(',') || null
        };
    }

    fetchModel({ url, data }) {
        return this.get(url, data).then(res => {
            return {
                data: res.data,
                repos: res.with,
                relMapping: res.with_mapping
            };
        });
    }

    saveModel({ url, data, isNew }) {
        const method = isNew ? 'patch' : 'post';
        return this[method](url, data).catch(err => {
            if (err.response) {
                err.valErrors = parseBackendValidationErrors(err.response);
            }
            throw err;
        });
    }

    deleteModel({ url }) {
        // TODO: kind of silly now, but we'll probably want better error handling soon.
        return this.delete(url);
    }

    buildFetchStoreParams(store) {
        const offset = store.getPageOffset();
        return {
            with: store.__activeRelations.join(',') || null,
            limit: store.__state.limit,
            // Hide offset if zero so the request looks cleaner in DevTools.
            offset: offset || null
        };
    }

    fetchStore({ url, data }) {
        return this.get(url, data).then(res => {
            return {
                data: res.data,
                repos: res.with,
                relMapping: res.with_mapping,
                totalRecords: res.meta.total_records
            };
        });
    }
};

export { Model, Store, BinderApi };
