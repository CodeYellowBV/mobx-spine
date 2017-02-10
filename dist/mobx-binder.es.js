import { action, computed, extendObservable, isObservable, observable, toJS } from 'mobx';
import { at, extend, filter, find, forIn, get, isArray, isPlainObject, keyBy, map, mapKeys, mapValues, snakeCase } from 'lodash';
import axios from 'axios';

let csrfToken = null;
let baseUrl = '';

// Function ripped from Django docs.
// See: https://docs.djangoproject.com/en/dev/ref/csrf/#ajax
function csrfSafeMethod(method) {
    // These HTTP methods do not require CSRF protection.
    return (/^(GET|HEAD|OPTIONS|TRACE)$/i.test(method)
    );
}

function request(method, url, data, options) {
    options || (options = {});
    const useCsrfToken = csrfSafeMethod(method) ? null : csrfToken;

    const axiosOptions = {
        method,
        baseURL: baseUrl,
        url,
        data: method !== 'get' && data,
        params: method === 'get' && data,
        headers: {
            'Content-Type': 'application/json',
            'X-Csrftoken': useCsrfToken
        }
    };

    extend(axiosOptions, options);

    const xhr = axios(axiosOptions).then(response => response.data);

    if (options.notifyException !== false) {
        xhr.catch(err => {
            const resp = err.response;
            if (resp && resp.status === 403 && resp.data.code === 'NotAuthenticated') {
                // TODO: We should do something here...
                return;
            }
        });
    }

    return xhr;
}

var request$1 = {
    get: (...args) => request.apply(undefined, ['get', ...args]),
    post: (...args) => request.apply(undefined, ['post', ...args]),
    patch: (...args) => request.apply(undefined, ['patch', ...args]),
    put: (...args) => request.apply(undefined, ['put', ...args]),
    delete: (...args) => request.apply(undefined, ['delete', ...args]),
    setCsrfToken: token => {
        csrfToken = token;
    },
    setBaseUrl: url => {
        baseUrl = url;
    },
    getBaseUrl: () => baseUrl
};

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

// lodash's `camelCase` method removes dots from the string; this breaks mobx-binder
function snakeToCamel(s) {
    return s.replace(/_\w/g, m => m[1].toUpperCase());
}

// TODO: need to find a good place for this
function parseBackendValidationErrors(response) {
    const valErrors = get(response, 'data.error.validation_errors');
    if (response.status === 400 && valErrors) {
        const camelCasedErrors = mapKeys(valErrors, (value, key) => snakeToCamel(key));
        return mapValues(camelCasedErrors, valError => {
            return valError.map(obj => obj.code);
        });
    }
    return false;
}

let Model = (_class = class Model {
    // Holds activated - nested - relations (e.g. `['animal', 'animal.breed']`)

    // TODO: Find out why `static primaryKey` doesn't work. I WANT IT STATIC GODDAMMIT.
    get url() {
        const id = this[this.primaryKey];
        return `${this.urlRoot}${id ? `${id}/` : ''}`;
    }
    // Holds activated - non-nested - relations (e.g. `['animal']`)

    // Holds original attributes with values, so `clear()` knows what to reset to (quite ugly).
    get isNew() {
        return !this[this.primaryKey];
    }

    get isLoading() {
        return this._pendingRequestCount > 0;
    }

    constructor(data, options = {}) {
        this.primaryKey = 'id';
        this._attributes = [];
        this._originalAttributes = {};
        this._activeRelations = [];
        this._activeCurrentRelations = [];

        _initDefineProp(this, '_backendValidationErrors', _descriptor, this);

        _initDefineProp(this, '_pendingRequestCount', _descriptor2, this);

        this._store = options.store;
        this.setRepository(options.repository);
        // Find all attributes. Not all observables are an attribute.
        forIn(this, (value, key) => {
            if (!key.startsWith('_') && isObservable(this, key)) {
                this._attributes.push(key);
                this._originalAttributes[key] = value;
            }
        });
        if (options.relations) {
            this.parseRelations(options.relations);
        }
        if (data) {
            this.parse(data);
        }
    }

    parseRelations(activeRelations) {
        this._activeRelations = activeRelations;
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
            this._activeCurrentRelations.push(currentRel);
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

    // Return the fetch params for including relations on the backend.
    parseRelationParams() {
        return {
            with: this._activeRelations.join(',') || null
        };
    }

    toBackend() {
        const output = {};
        this._attributes.forEach(attr => {
            output[snakeCase(attr)] = this[attr];
        });
        // Add active relations as id.
        this._activeCurrentRelations.forEach(currentRel => {
            const model = this[currentRel];
            if (model) {
                output[snakeCase(currentRel)] = model[model.primaryKey];
            }
        });
        return output;
    }

    toJS() {
        const output = {};
        this._attributes.forEach(attr => {
            output[attr] = toJS(this[attr]);
        });

        this._activeCurrentRelations.forEach(currentRel => {
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
            model.setRepository(repository);
        });

        // Now all repositories are set on the relations, start parsing the actual data.
        // `parse()` will recursively fill in all relations.
        if (data) {
            this.parse(data);
        }
    }

    setRepository(repository) {
        this._repository = repository;
    }

    addFromRepository(id) {
        const relData = find(this._repository, { id });
        if (relData) {
            this.parse(relData);
        }
    }

    parse(data) {
        const formattedData = mapKeys(data, (value, key) => snakeToCamel(key));

        this._attributes.forEach(attr => {
            if (formattedData[attr] !== undefined) {
                this[attr] = formattedData[attr];
            }
        });

        this._activeCurrentRelations.forEach(currentRel => {
            // In Binder, a relation property is an `int` or `[int]`, referring to its ID.
            // However, it can also be an object if there are nested relations (non flattened).
            if (isPlainObject(formattedData[currentRel]) || isPlainObject(get(formattedData[currentRel], '[0]'))) {
                this[currentRel].parse(formattedData[currentRel]);
            } else {
                this[currentRel].addFromRepository(formattedData[currentRel]);
            }
        });
    }

    save() {
        this._backendValidationErrors = {};
        this._pendingRequestCount += 1;
        // TODO: Allow data from an argument to be saved?
        const method = this[this.primaryKey] ? 'patch' : 'post';
        return request$1[method](this.url, this.toBackend()).then(action(data => {
            this._pendingRequestCount -= 1;
            this.parse(data);
        })).catch(action(err => {
            // TODO: I'm not particularly happy about this implementation.
            this._pendingRequestCount -= 1;
            if (err.response) {
                const valErrors = parseBackendValidationErrors(err.response);
                if (valErrors) {
                    this._backendValidationErrors = valErrors;
                }
            }
            throw err;
        }));
    }

    // TODO: This is a bit hacky...
    get backendValidationErrors() {
        return this._backendValidationErrors;
    }

    delete() {
        // TODO: currently this always does a optimistic delete (meaning it doesn't wait on the request)
        // Do we want a non-optimistic delete?
        if (this._store) {
            this._store.remove(this);
        }
        if (this[this.primaryKey]) {
            this._pendingRequestCount += 1;
            return request$1.delete(this.url).then(action(() => {
                this._pendingRequestCount -= 1;
            }));
        }
        return Promise.resolve();
    }

    fetch(options = {}) {
        // TODO: I feel like we should give a clear error message when `urlRoot` is not defined.
        if (!this[this.primaryKey]) {
            throw new Error('Trying to fetch model without id!');
        }
        this._pendingRequestCount += 1;
        const data = Object.assign(this.parseRelationParams(), options.data);
        return request$1.get(this.url, data).then(action(res => {
            this._pendingRequestCount -= 1;

            this.fromBackend({
                data: res.data,
                repos: res.with,
                relMapping: res.with_mapping
            });
        }));
    }

    clear() {
        forIn(this._originalAttributes, (value, key) => {
            this[key] = value;
        });

        this._activeCurrentRelations.forEach(currentRel => {
            this[currentRel].clear();
        });
    }
}, (_descriptor = _applyDecoratedDescriptor(_class.prototype, '_backendValidationErrors', [observable], {
    enumerable: true,
    initializer: function () {
        return {};
    }
}), _descriptor2 = _applyDecoratedDescriptor(_class.prototype, '_pendingRequestCount', [observable], {
    enumerable: true,
    initializer: function () {
        return 0;
    }
}), _applyDecoratedDescriptor(_class.prototype, 'url', [computed], Object.getOwnPropertyDescriptor(_class.prototype, 'url'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'isNew', [computed], Object.getOwnPropertyDescriptor(_class.prototype, 'isNew'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'isLoading', [computed], Object.getOwnPropertyDescriptor(_class.prototype, 'isLoading'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'parseRelations', [action], Object.getOwnPropertyDescriptor(_class.prototype, 'parseRelations'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'fromBackend', [action], Object.getOwnPropertyDescriptor(_class.prototype, 'fromBackend'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'parse', [action], Object.getOwnPropertyDescriptor(_class.prototype, 'parse'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'save', [action], Object.getOwnPropertyDescriptor(_class.prototype, 'save'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'backendValidationErrors', [computed], Object.getOwnPropertyDescriptor(_class.prototype, 'backendValidationErrors'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'delete', [action], Object.getOwnPropertyDescriptor(_class.prototype, 'delete'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'fetch', [action], Object.getOwnPropertyDescriptor(_class.prototype, 'fetch'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'clear', [action], Object.getOwnPropertyDescriptor(_class.prototype, 'clear'), _class.prototype)), _class);

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
    // Holds the fetch parameters
    get isLoading() {
        return this._pendingRequestCount > 0;
    }

    get length() {
        return this.models.length;
    }

    constructor(data, options = {}) {
        _initDefineProp$1(this, 'models', _descriptor$1, this);

        _initDefineProp$1(this, 'params', _descriptor2$1, this);

        _initDefineProp$1(this, '_pendingRequestCount', _descriptor3, this);

        _initDefineProp$1(this, '_state', _descriptor4, this);

        this._activeRelations = [];
        this.Model = null;

        if (options.relations) {
            this.parseRelations(options.relations);
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

    parseRelations(activeRelations) {
        this._activeRelations = activeRelations;
    }

    setRepository(repository) {
        this._repository = repository;
    }

    addFromRepository(ids = []) {
        ids = isArray(ids) ? ids : [ids];

        const records = at(keyBy(this._repository, 'id'), ids);
        this.models.replace(records.map(record => {
            return new this.Model(record, {
                store: this
            });
        }));
    }

    buildParams() {
        const offset = this.getPageOffset();
        return {
            with: this._activeRelations.join(',') || null,
            limit: this._state.limit,
            // Hide offset if zero so the request looks cleaner in DevTools.
            offset: offset || null
        };
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
            relations: this._activeRelations
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
        this._pendingRequestCount += 1;
        const params = Object.assign(this.buildParams(), this.params, options.data);
        return request$1.get(this.url, params).then(action(res => {
            this._pendingRequestCount -= 1;
            this._state.totalRecords = res.meta.total_records;
            this.fromBackend({
                data: res.data,
                repos: res.with,
                relMapping: res.with_mapping
            });
        }));
    }

    toJS() {
        return this.models.map(model => model.toJS());
    }

    // Methods for pagination.

    getPageOffset() {
        return (this._state.currentPage - 1) * this._state.limit;
    }

    setLimit(limit) {
        if (limit && !Number.isInteger(limit)) {
            throw new Error('Page limit should be a number or falsy value.');
        }
        this._state.limit = limit || null;
    }

    get totalPages() {
        if (!this._state.limit) {
            return 0;
        }
        return Math.ceil(this._state.totalRecords / this._state.limit);
    }

    get currentPage() {
        return this._state.currentPage;
    }

    get hasNextPage() {
        return this._state.currentPage + 1 <= this.totalPages;
    }

    get hasPreviousPage() {
        return this._state.currentPage > 1;
    }

    getNextPage() {
        if (!this.hasNextPage) {
            throw new Error('There is no next page.');
        }
        this._state.currentPage += 1;
        return this.fetch();
    }

    getPreviousPage() {
        if (!this.hasPreviousPage) {
            throw new Error('There is no previous page.');
        }
        this._state.currentPage -= 1;
        return this.fetch();
    }

    setPage(page = 1, options = {}) {
        if (!Number.isInteger(page)) {
            throw new Error('Page should be a number.');
        }
        if (page > this.totalPages || page < 1) {
            throw new Error(`Page should be between 1 and ${this.totalPages}.`);
        }
        this._state.currentPage = page;
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
}), _descriptor3 = _applyDecoratedDescriptor$1(_class$1.prototype, '_pendingRequestCount', [observable], {
    enumerable: true,
    initializer: function () {
        return 0;
    }
}), _descriptor4 = _applyDecoratedDescriptor$1(_class$1.prototype, '_state', [observable], {
    enumerable: true,
    initializer: function () {
        return {
            currentPage: 1,
            limit: 25,
            totalRecords: 0
        };
    }
}), _applyDecoratedDescriptor$1(_class$1.prototype, 'isLoading', [computed], Object.getOwnPropertyDescriptor(_class$1.prototype, 'isLoading'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'length', [computed], Object.getOwnPropertyDescriptor(_class$1.prototype, 'length'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'fromBackend', [action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'fromBackend'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'parse', [action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'parse'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'add', [action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'add'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'remove', [action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'remove'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'clear', [action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'clear'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'fetch', [action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'fetch'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'setLimit', [action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'setLimit'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'totalPages', [computed], Object.getOwnPropertyDescriptor(_class$1.prototype, 'totalPages'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'currentPage', [computed], Object.getOwnPropertyDescriptor(_class$1.prototype, 'currentPage'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'hasNextPage', [computed], Object.getOwnPropertyDescriptor(_class$1.prototype, 'hasNextPage'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'hasPreviousPage', [computed], Object.getOwnPropertyDescriptor(_class$1.prototype, 'hasPreviousPage'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'getNextPage', [action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'getNextPage'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'getPreviousPage', [action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'getPreviousPage'), _class$1.prototype), _applyDecoratedDescriptor$1(_class$1.prototype, 'setPage', [action], Object.getOwnPropertyDescriptor(_class$1.prototype, 'setPage'), _class$1.prototype)), _class$1);

export { Model, Store, request$1 as request };
