import {
    action,
    autorun,
    computed,
    extendObservable,
    isObservable,
    isObservableArray,
    isObservableObject,
    observable,
    toJS,
} from 'mobx';
import {
    at,
    filter,
    find,
    forIn,
    get,
    isArray,
    isPlainObject,
    keyBy,
    map,
    mapKeys,
    mapValues,
    result,
    snakeCase,
    uniqueId,
} from 'lodash';
import axios from 'axios';
import moment from 'moment';

// lodash's `camelCase` method removes dots from the string; this breaks mobx-spine
function snakeToCamel(s) {
    if (s.startsWith('_')) {
        return s;
    }
    return s.replace(/_\w/g, m => m[1].toUpperCase());
}

var _class$1;
var _descriptor$1;
var _descriptor2$1;
var _descriptor3$1;
var _descriptor4;
var _class2$1;
var _temp$1;

function _initDefineProp$1(target, property, descriptor, context) {
    if (!descriptor) return;
    Object.defineProperty(target, property, {
        enumerable: descriptor.enumerable,
        configurable: descriptor.configurable,
        writable: descriptor.writable,
        value: descriptor.initializer
            ? descriptor.initializer.call(context)
            : void 0,
    });
}

function _applyDecoratedDescriptor$1(
    target,
    property,
    decorators,
    descriptor,
    context
) {
    var desc = {};
    Object['ke' + 'ys'](descriptor).forEach(function(key) {
        desc[key] = descriptor[key];
    });
    desc.enumerable = !!desc.enumerable;
    desc.configurable = !!desc.configurable;

    if ('value' in desc || desc.initializer) {
        desc.writable = true;
    }

    desc = decorators.slice().reverse().reduce(function(desc, decorator) {
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

const AVAILABLE_CONST_OPTIONS = ['relations', 'limit'];

let Store = ((_class$1 = ((_temp$1 = _class2$1 = class Store {
    get isLoading() {
        return this.__pendingRequestCount > 0;
    }
    // Holds the fetch parameters
    get length() {
        return this.models.length;
    }

    set backendResourceName(v) {
        throw new Error(
            '`backendResourceName` should be a static property on the store.'
        );
    }

    // Empty function, but can be overridden if you want to do something after initializing the model.
    initialize() {}

    constructor(options = {}) {
        _initDefineProp$1(this, 'models', _descriptor$1, this);

        _initDefineProp$1(this, 'params', _descriptor2$1, this);

        _initDefineProp$1(this, '__pendingRequestCount', _descriptor3$1, this);

        _initDefineProp$1(this, '__state', _descriptor4, this);

        this.__activeRelations = [];
        this.Model = null;
        this.api = null;
        this.__nestedRepository = {};

        if (!isPlainObject(options)) {
            throw Error(
                'Store only accepts an object with options. Chain `.parse(data)` to add models.'
            );
        }
        forIn(options, (value, option) => {
            if (!AVAILABLE_CONST_OPTIONS.includes(option)) {
                throw Error(`Unknown option passed to store: ${option}`);
            }
        });
        if (options.relations) {
            this.__parseRelations(options.relations);
        }
        if (options.limit !== undefined) {
            this.setLimit(options.limit);
        }
        this.initialize();
    }

    __parseRelations(activeRelations) {
        this.__activeRelations = activeRelations;
    }

    __addFromRepository(ids = []) {
        ids = isArray(ids) ? ids : [ids];

        const records = at(
            keyBy(this.__repository, this.Model.primaryKey),
            ids
        );
        this.models.replace(
            records.map(record => {
                return new this.Model(record, {
                    store: this,
                    relations: this.__activeRelations,
                });
            })
        );
    }

    __getApi() {
        if (!this.api) {
            throw new Error(
                'You are trying to perform a API request without an `api` property defined on the store.'
            );
        }
        if (!this.url) {
            throw new Error(
                'You are trying to perform a API request without an `url` property defined on the store.'
            );
        }
        return this.api;
    }

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
    }

    _newModel(model = null) {
        return new this.Model(model, {
            store: this,
            relations: this.__activeRelations,
        });
    }

    parse(models) {
        if (!isArray(models)) {
            throw new Error('Parameter supplied to parse() is not an array.');
        }
        this.models.replace(models.map(this._newModel.bind(this)));

        return this;
    }

    add(models) {
        const singular = !isArray(models);
        models = singular ? [models] : models.slice();

        const modelInstances = models.map(this._newModel.bind(this));

        modelInstances.forEach(modelInstance => {
            const primaryValue = modelInstance[this.Model.primaryKey];
            if (primaryValue && this.get(primaryValue)) {
                throw Error(
                    `A model with the same primary key value "${primaryValue}" already exists in this store.`
                );
            }
            this.models.push(modelInstance);
        });

        return singular ? modelInstances[0] : modelInstances;
    }

    remove(models) {
        const singular = !isArray(models);
        models = singular ? [models] : models.slice();

        models.forEach(model => this.models.remove(model));

        return models;
    }

    removeById(ids) {
        const singular = !isArray(ids);
        ids = singular ? [ids] : ids.slice();
        if (ids.some(isNaN)) {
            throw new Error(
                `Cannot remove a model by id that is not a number: ${JSON.stringify(ids)}`
            );
        }

        const models = ids.map(id => this.get(id));

        models.forEach(model => {
            if (model) {
                this.models.remove(model);
            }
        });

        return models;
    }

    clear() {
        this.models.clear();
    }

    fetch(options = {}) {
        this.__pendingRequestCount += 1;
        const data = Object.assign(
            this.__getApi().buildFetchStoreParams(this),
            this.params,
            options.data
        );
        return this.__getApi()
            .fetchStore({ url: result(this, 'url'), data })
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
            });
        });

        return { data, relations };
    }

    // Create a new instance of this store with a predicate applied.
    // This new store will be automatically kept in-sync with all models that adhere to the predicate.
    virtualStore({ filter: filter$$1 }) {
        const store = new this.constructor({
            relations: this.__activeRelations,
        });
        // Oh gawd MobX is so awesome.
        autorun(() => {
            const models = this.filter(filter$$1);
            store.models.replace(models);
        });
        return store;
    }

    // Helper methods to read models.

    get(id) {
        // The id can be defined as a string or int, but we want it to work in both cases.
        return this.models.find(
            model => model[model.constructor.primaryKey] == id // eslint-disable-line eqeqeq
        );
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

    at(index) {
        const zeroLength = this.length - 1;
        if (index > zeroLength) {
            throw new Error(
                `Index ${index} is out of bounds (max ${zeroLength}).`
            );
        }
        if (index < 0) {
            index += this.length;
        }
        return this.models[index];
    }
}), (_class2$1.backendResourceName =
    ''), _temp$1)), ((_descriptor$1 = _applyDecoratedDescriptor$1(
    _class$1.prototype,
    'models',
    [observable],
    {
        enumerable: true,
        initializer: function() {
            return [];
        },
    }
)), (_descriptor2$1 = _applyDecoratedDescriptor$1(
    _class$1.prototype,
    'params',
    [observable],
    {
        enumerable: true,
        initializer: function() {
            return {};
        },
    }
)), (_descriptor3$1 = _applyDecoratedDescriptor$1(
    _class$1.prototype,
    '__pendingRequestCount',
    [observable],
    {
        enumerable: true,
        initializer: function() {
            return 0;
        },
    }
)), (_descriptor4 = _applyDecoratedDescriptor$1(
    _class$1.prototype,
    '__state',
    [observable],
    {
        enumerable: true,
        initializer: function() {
            return {
                currentPage: 1,
                limit: 25,
                totalRecords: 0,
            };
        },
    }
)), _applyDecoratedDescriptor$1(
    _class$1.prototype,
    'isLoading',
    [computed],
    Object.getOwnPropertyDescriptor(_class$1.prototype, 'isLoading'),
    _class$1.prototype
), _applyDecoratedDescriptor$1(
    _class$1.prototype,
    'length',
    [computed],
    Object.getOwnPropertyDescriptor(_class$1.prototype, 'length'),
    _class$1.prototype
), _applyDecoratedDescriptor$1(
    _class$1.prototype,
    'fromBackend',
    [action],
    Object.getOwnPropertyDescriptor(_class$1.prototype, 'fromBackend'),
    _class$1.prototype
), _applyDecoratedDescriptor$1(
    _class$1.prototype,
    'parse',
    [action],
    Object.getOwnPropertyDescriptor(_class$1.prototype, 'parse'),
    _class$1.prototype
), _applyDecoratedDescriptor$1(
    _class$1.prototype,
    'add',
    [action],
    Object.getOwnPropertyDescriptor(_class$1.prototype, 'add'),
    _class$1.prototype
), _applyDecoratedDescriptor$1(
    _class$1.prototype,
    'remove',
    [action],
    Object.getOwnPropertyDescriptor(_class$1.prototype, 'remove'),
    _class$1.prototype
), _applyDecoratedDescriptor$1(
    _class$1.prototype,
    'removeById',
    [action],
    Object.getOwnPropertyDescriptor(_class$1.prototype, 'removeById'),
    _class$1.prototype
), _applyDecoratedDescriptor$1(
    _class$1.prototype,
    'clear',
    [action],
    Object.getOwnPropertyDescriptor(_class$1.prototype, 'clear'),
    _class$1.prototype
), _applyDecoratedDescriptor$1(
    _class$1.prototype,
    'fetch',
    [action],
    Object.getOwnPropertyDescriptor(_class$1.prototype, 'fetch'),
    _class$1.prototype
), _applyDecoratedDescriptor$1(
    _class$1.prototype,
    'setLimit',
    [action],
    Object.getOwnPropertyDescriptor(_class$1.prototype, 'setLimit'),
    _class$1.prototype
), _applyDecoratedDescriptor$1(
    _class$1.prototype,
    'totalPages',
    [computed],
    Object.getOwnPropertyDescriptor(_class$1.prototype, 'totalPages'),
    _class$1.prototype
), _applyDecoratedDescriptor$1(
    _class$1.prototype,
    'currentPage',
    [computed],
    Object.getOwnPropertyDescriptor(_class$1.prototype, 'currentPage'),
    _class$1.prototype
), _applyDecoratedDescriptor$1(
    _class$1.prototype,
    'hasNextPage',
    [computed],
    Object.getOwnPropertyDescriptor(_class$1.prototype, 'hasNextPage'),
    _class$1.prototype
), _applyDecoratedDescriptor$1(
    _class$1.prototype,
    'hasPreviousPage',
    [computed],
    Object.getOwnPropertyDescriptor(_class$1.prototype, 'hasPreviousPage'),
    _class$1.prototype
), _applyDecoratedDescriptor$1(
    _class$1.prototype,
    'getNextPage',
    [action],
    Object.getOwnPropertyDescriptor(_class$1.prototype, 'getNextPage'),
    _class$1.prototype
), _applyDecoratedDescriptor$1(
    _class$1.prototype,
    'getPreviousPage',
    [action],
    Object.getOwnPropertyDescriptor(_class$1.prototype, 'getPreviousPage'),
    _class$1.prototype
), _applyDecoratedDescriptor$1(
    _class$1.prototype,
    'setPage',
    [action],
    Object.getOwnPropertyDescriptor(_class$1.prototype, 'setPage'),
    _class$1.prototype
)), _class$1);

var _class;
var _descriptor;
var _descriptor2;
var _descriptor3;
var _class2;
var _temp;

function _initDefineProp(target, property, descriptor, context) {
    if (!descriptor) return;
    Object.defineProperty(target, property, {
        enumerable: descriptor.enumerable,
        configurable: descriptor.configurable,
        writable: descriptor.writable,
        value: descriptor.initializer
            ? descriptor.initializer.call(context)
            : void 0,
    });
}

function _applyDecoratedDescriptor(
    target,
    property,
    decorators,
    descriptor,
    context
) {
    var desc = {};
    Object['ke' + 'ys'](descriptor).forEach(function(key) {
        desc[key] = descriptor[key];
    });
    desc.enumerable = !!desc.enumerable;
    desc.configurable = !!desc.configurable;

    if ('value' in desc || desc.initializer) {
        desc.writable = true;
    }

    desc = decorators.slice().reverse().reduce(function(desc, decorator) {
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

function generateNegativeId() {
    return -parseInt(uniqueId());
}

function concatInDict(dict, key, value) {
    dict[key] = dict[key] ? dict[key].concat(value) : value;
}

let Model = ((_class = ((_temp = _class2 = class Model {
    // A `cid` can be used to identify the model locally.

    // Holds activated - non-nested - relations (e.g. `['animal']`)

    // Holds original attributes with values, so `clear()` knows what to reset to (quite ugly).
    get url() {
        const id = this[this.constructor.primaryKey];
        return `${this.urlRoot}${id ? `${id}/` : ''}`;
    }
    // URL query params that are added to fetch requests.

    // Holds activated - nested - relations (e.g. `['animal', 'animal.breed']`)

    // How the model is known at the backend. This is useful when the model is in a relation that has a different name.
    get isNew() {
        return !this[this.constructor.primaryKey];
    }

    get isLoading() {
        return this.__pendingRequestCount > 0;
    }

    set primaryKey(v) {
        throw new Error(
            '`primaryKey` should be a static property on the model.'
        );
    }

    set backendResourceName(v) {
        throw new Error(
            '`backendResourceName` should be a static property on the model.'
        );
    }

    casts() {
        return {};
    }

    // Empty function, but can be overridden if you want to do something after initializing the model.
    initialize() {}

    constructor(data, options = {}) {
        this.__attributes = [];
        this.__originalAttributes = {};
        this.__activeRelations = [];
        this.__activeCurrentRelations = [];
        this.api = null;
        this.cid = `m${uniqueId()}`;

        _initDefineProp(this, '__backendValidationErrors', _descriptor, this);

        _initDefineProp(this, '__pendingRequestCount', _descriptor2, this);

        _initDefineProp(this, '__fetchParams', _descriptor3, this);

        this.__store = options.store;
        this.__repository = options.repository;
        // Find all attributes. Not all observables are an attribute.
        forIn(this, (value, key) => {
            if (!key.startsWith('__') && isObservable(this, key)) {
                this.__attributes.push(key);
                let newValue = value;
                // An array or object observable can be mutated, so we want to ensure we always have
                // the original not-yet-mutated object/array.
                if (isObservableArray(value)) {
                    newValue = value.slice();
                } else if (isObservableObject(value)) {
                    newValue = Object.assign({}, value);
                }
                this.__originalAttributes[key] = newValue;
            }
        });
        if (options.relations) {
            this.__parseRelations(options.relations);
        }
        if (data) {
            this.parse(data);
        }
        this.initialize();
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
            relModels[currentRel] = currentProp
                ? currentProp.concat(otherRels)
                : otherRels;
            if (!this.__activeCurrentRelations.includes(currentRel)) {
                this.__activeCurrentRelations.push(currentRel);
            }
        });
        extendObservable(
            this,
            mapValues(relModels, (otherRelNames, relName) => {
                const RelModel = relations[relName];
                if (!RelModel) {
                    throw new Error(
                        `Specified relation "${relName}" does not exist on model.`
                    );
                }
                const options = { relations: otherRelNames };
                if (this.__store && this.__store.__nestedRepository[relName]) {
                    options.repository = this.__store.__nestedRepository[
                        relName
                    ];
                }
                if (RelModel.prototype instanceof Store) {
                    return new RelModel(options);
                }
                return new RelModel(null, options);
            })
        );
    }

    toBackend() {
        const output = {};
        this.__attributes.forEach(attr => {
            if (!attr.startsWith('_')) {
                output[snakeCase(attr)] = this.__toJSAttr(attr, this[attr]);
            }
        });
        // Add active relations as id.
        this.__activeCurrentRelations.forEach(currentRel => {
            const rel = this[currentRel];
            const relBackendName = snakeCase(currentRel);
            if (rel instanceof Model) {
                output[relBackendName] = rel[rel.constructor.primaryKey];
            }
            if (rel instanceof Store) {
                output[relBackendName] = rel.mapByPrimaryKey();
            }
        });
        return output;
    }

    toBackendAll(newId, options = {}) {
        // TODO: This implementation is more a proof of concept; it's very shitty coded.
        const includeRelations = options.relations || [];
        const data = this.toBackend();
        const relations = {};

        if (newId) {
            data[this.constructor.primaryKey] = newId;
        } else if (data[this.constructor.primaryKey] === null) {
            data[this.constructor.primaryKey] = generateNegativeId();
        }

        this.__activeCurrentRelations.forEach(currentRel => {
            const rel = this[currentRel];
            let myNewId = null;
            const relBackendName = snakeCase(currentRel);
            if (data[relBackendName] === null) {
                myNewId = generateNegativeId();
                data[relBackendName] = myNewId;
            }
            if (isArray(data[relBackendName])) {
                myNewId = data[relBackendName].map(
                    id => (id === null ? generateNegativeId() : id)
                );
                data[relBackendName] = myNewId;
            }

            // `includeRelations` can look like `['kind.breed', 'owner']`
            // Check to see if `currentRel` matches the first part of the relation (`kind` or `owner`)
            const includeRelationData = includeRelations.filter(rel => {
                const nestedRels = rel.split('.');
                return nestedRels.length > 0
                    ? nestedRels[0] === currentRel
                    : false;
            });
            if (includeRelationData.length > 0) {
                // We want to pass through nested relations to the next relation, but pop of the first level.
                const relativeRelations = includeRelationData
                    .map(rel => {
                        const nestedRels = rel.split('.');
                        nestedRels.shift();
                        return nestedRels.join('.');
                    })
                    .filter(rel => !!rel);
                const relBackendData = rel.toBackendAll(myNewId, {
                    relations: relativeRelations,
                });
                // Sometimes the backend knows the relation by a different name, e.g. the relation is called
                // `activities`, but the name in the backend is `activity`.
                // In that case, you can add `static backendResourceName = 'activity';` to that model.
                const realBackendName =
                    rel.constructor.backendResourceName || relBackendName;
                concatInDict(relations, realBackendName, relBackendData.data);
                forIn(relBackendData.relations, (relB, key) => {
                    concatInDict(relations, key, relB);
                });
            }
        });

        return { data: [data], relations };
    }

    toJS() {
        const output = {};
        this.__attributes.forEach(attr => {
            output[attr] = this.__toJSAttr(attr, this[attr]);
        });

        this.__activeCurrentRelations.forEach(currentRel => {
            const model = this[currentRel];
            if (model) {
                output[currentRel] = model.toJS();
            }
        });
        return output;
    }

    __toJSAttr(attr, value) {
        const casts = this.casts();
        const cast = casts[attr];
        if (cast !== undefined) {
            return toJS(cast.toJS(attr, value));
        }
        return toJS(value);
    }

    setFetchParams(params) {
        this.__fetchParams = Object.assign({}, params);
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
            let model = get(this, snakeToCamel(relName));

            // If we have a model which has a store relation which has a nested relation,
            // the model doesn't exist yet
            if (model === undefined) {
                // We need to find the first store in the chain
                // But we currently only support Model > Store > Model
                // If there are more Models/Store in the length the "find first store in chain"
                // needs to be implemented
                const rels = relName.split('.');
                let store;
                let nestedRel;

                // Find the first Store relation in the relation chain
                rels.some((rel, i) => {
                    // Try rel, rel.rel, rel.rel.rel, etc.
                    const subRelName = rels.slice(0, i + 1).join('.');
                    const subRel = get(this, snakeToCamel(subRelName));

                    if (subRel instanceof Store) {
                        store = subRel;
                        // Now we found the store.
                        // The store has models, and those models have another (model) relation.
                        //
                        // We need to set the a `__nestedRepository` in the store
                        // That means that when models get added to the store,
                        // Their relation is filled from the correct `__nestedRepository` in the store.
                        //
                        // So a Dog has PastOwners (store), the Owners in that store have a Town rel.
                        // We set 'town': repository in the `__nestedRepository` of the PastOwners
                        // When Owners get added, parsed, whatever, their town relation is set,
                        // using `Store.__nestedRepository`.
                        nestedRel = rels.slice(i + 1, rels.length).join('.');
                        return true;
                    }
                    return false;
                });
                store.__nestedRepository[nestedRel] = repository;
            } else {
                model.__repository = repository;
            }
        });

        // Now all repositories are set on the relations, start parsing the actual data.
        // `parse()` will recursively fill in all relations.
        if (data) {
            this.parse(data);
        }
    }

    __getApi() {
        if (!this.api) {
            throw new Error(
                'You are trying to perform a API request without an `api` property defined on the model.'
            );
        }
        if (!this.urlRoot) {
            throw new Error(
                'You are trying to perform a API request without an `urlRoot` property defined on the model.'
            );
        }
        return this.api;
    }

    __addFromRepository(id) {
        const relData = find(this.__repository, { id });
        if (relData) {
            this.parse(relData);
        }
    }

    parse(data) {
        if (!isPlainObject(data)) {
            throw new Error('Parameter supplied to parse() is not an object.');
        }
        forIn(data, (value, key) => {
            const attr = snakeToCamel(key);
            if (this.__attributes.includes(attr)) {
                this[attr] = this.__parseAttr(attr, value);
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

        return this;
    }

    __parseAttr(attr, value) {
        const casts = this.casts();
        const cast = casts[attr];
        if (cast !== undefined) {
            return cast.parse(attr, value);
        }
        return value;
    }

    save(options = {}) {
        this.__backendValidationErrors = {};
        this.__pendingRequestCount += 1;
        // TODO: Allow data from an argument to be saved?
        return this.__getApi()
            .saveModel({
                url: this.url,
                data: this.toBackend(),
                params: options.params,
                isNew: this.isNew,
            })
            .then(
                action(res => {
                    this.__pendingRequestCount -= 1;
                    this.saveFromBackend(res);
                })
            )
            .catch(
                action(err => {
                    this.__pendingRequestCount -= 1;
                    if (err.valErrors) {
                        this.__backendValidationErrors = err.valErrors;
                    }
                    throw err;
                })
            );
    }

    saveAll(options = {}) {
        this.__backendValidationErrors = {};
        this.__pendingRequestCount += 1;
        return this.__getApi()
            .saveAllModels({
                url: this.urlRoot,
                data: this.toBackendAll(null, { relations: options.relations }),
            })
            .then(
                action(res => {
                    this.__pendingRequestCount -= 1;
                    this.saveFromBackend(res);
                })
            )
            .catch(
                action(err => {
                    this.__pendingRequestCount -= 1;
                    // TODO: saveAll does not support handling backend validation errors yet.
                    throw err;
                })
            );
    }

    // This is just a pass-through to make it easier to override parsing backend responses from the backend.
    // Sometimes the backend won't return the model after a save because e.g. it is created async.
    saveFromBackend(res) {
        return this.fromBackend(res);
    }

    // TODO: This is a bit hacky...
    get backendValidationErrors() {
        return this.__backendValidationErrors;
    }

    delete(options = {}) {
        const removeFromStore = () =>
            (this.__store ? this.__store.remove(this) : null);
        if (options.immediate || this.isNew) {
            removeFromStore();
        }
        if (this.isNew) {
            return Promise.resolve();
        }

        this.__pendingRequestCount += 1;
        return this.__getApi()
            .deleteModel({ url: this.url, params: options.params })
            .then(
                action(() => {
                    this.__pendingRequestCount -= 1;
                    if (!options.immediate) {
                        removeFromStore();
                    }
                })
            );
    }

    fetch(options = {}) {
        if (this.isNew) {
            throw new Error('Trying to fetch model without id!');
        }
        this.__pendingRequestCount += 1;
        const data = Object.assign(
            this.__getApi().buildFetchModelParams(this),
            this.__fetchParams,
            options.data
        );
        return this.__getApi().fetchModel({ url: this.url, data }).then(
            action(res => {
                this.fromBackend(res);
                this.__pendingRequestCount -= 1;
            })
        );
    }

    clear() {
        forIn(this.__originalAttributes, (value, key) => {
            this[key] = value;
        });

        this.__activeCurrentRelations.forEach(currentRel => {
            this[currentRel].clear();
        });
    }
}), (_class2.primaryKey = 'id'), (_class2.backendResourceName =
    ''), _temp)), ((_descriptor = _applyDecoratedDescriptor(
    _class.prototype,
    '__backendValidationErrors',
    [observable],
    {
        enumerable: true,
        initializer: function() {
            return {};
        },
    }
)), (_descriptor2 = _applyDecoratedDescriptor(
    _class.prototype,
    '__pendingRequestCount',
    [observable],
    {
        enumerable: true,
        initializer: function() {
            return 0;
        },
    }
)), (_descriptor3 = _applyDecoratedDescriptor(
    _class.prototype,
    '__fetchParams',
    [observable],
    {
        enumerable: true,
        initializer: function() {
            return {};
        },
    }
)), _applyDecoratedDescriptor(
    _class.prototype,
    'url',
    [computed],
    Object.getOwnPropertyDescriptor(_class.prototype, 'url'),
    _class.prototype
), _applyDecoratedDescriptor(
    _class.prototype,
    'isNew',
    [computed],
    Object.getOwnPropertyDescriptor(_class.prototype, 'isNew'),
    _class.prototype
), _applyDecoratedDescriptor(
    _class.prototype,
    'isLoading',
    [computed],
    Object.getOwnPropertyDescriptor(_class.prototype, 'isLoading'),
    _class.prototype
), _applyDecoratedDescriptor(
    _class.prototype,
    '__parseRelations',
    [action],
    Object.getOwnPropertyDescriptor(_class.prototype, '__parseRelations'),
    _class.prototype
), _applyDecoratedDescriptor(
    _class.prototype,
    'fromBackend',
    [action],
    Object.getOwnPropertyDescriptor(_class.prototype, 'fromBackend'),
    _class.prototype
), _applyDecoratedDescriptor(
    _class.prototype,
    'parse',
    [action],
    Object.getOwnPropertyDescriptor(_class.prototype, 'parse'),
    _class.prototype
), _applyDecoratedDescriptor(
    _class.prototype,
    'save',
    [action],
    Object.getOwnPropertyDescriptor(_class.prototype, 'save'),
    _class.prototype
), _applyDecoratedDescriptor(
    _class.prototype,
    'saveAll',
    [action],
    Object.getOwnPropertyDescriptor(_class.prototype, 'saveAll'),
    _class.prototype
), _applyDecoratedDescriptor(
    _class.prototype,
    'backendValidationErrors',
    [computed],
    Object.getOwnPropertyDescriptor(
        _class.prototype,
        'backendValidationErrors'
    ),
    _class.prototype
), _applyDecoratedDescriptor(
    _class.prototype,
    'delete',
    [action],
    Object.getOwnPropertyDescriptor(_class.prototype, 'delete'),
    _class.prototype
), _applyDecoratedDescriptor(
    _class.prototype,
    'fetch',
    [action],
    Object.getOwnPropertyDescriptor(_class.prototype, 'fetch'),
    _class.prototype
), _applyDecoratedDescriptor(
    _class.prototype,
    'clear',
    [action],
    Object.getOwnPropertyDescriptor(_class.prototype, 'clear'),
    _class.prototype
)), _class);

// lodash's `snakeCase` method removes dots from the string; this breaks mobx-spine
function camelToSnake(s) {
    if (s.startsWith('_')) {
        return s;
    }
    return s.replace(/([A-Z])/g, $1 => '_' + $1.toLowerCase());
}

// Function ripped from Django docs.
// See: https://docs.djangoproject.com/en/dev/ref/csrf/#ajax
function csrfSafeMethod(method) {
    // These HTTP methods do not require CSRF protection.
    return /^(GET|HEAD|OPTIONS|TRACE)$/i.test(method);
}

function parseBackendValidationErrors(response) {
    const valErrors = get(response, 'data.error.validation_errors');
    if (response.status === 400 && valErrors) {
        const camelCasedErrors = mapKeys(valErrors, (value, key) =>
            snakeToCamel(key)
        );
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
        const useCsrfToken = csrfSafeMethod(method)
            ? undefined
            : this.csrfToken;
        this.__testUrl(url);

        const axiosOptions = {
            method,
            baseURL: this.baseUrl,
            url,
            data: method !== 'get' && data ? data : undefined,
            params: method === 'get' && data ? data : options.params,
            headers: Object.assign(
                {
                    'Content-Type': 'application/json',
                    'X-Csrftoken': useCsrfToken,
                },
                this.defaultHeaders
            ),
        };

        Object.assign(axiosOptions, options);

        const xhr = axios(axiosOptions);

        // We fork the promise tree as we want to have the error traverse to the listeners
        if (this.onRequestError && options.skipRequestError !== true) {
            xhr.catch(this.onRequestError);
        }

        const onSuccess = options.skipFormatter === true
            ? Promise.resolve()
            : this.__responseFormatter;
        return xhr.then(onSuccess);
    }

    __responseFormatter(res) {
        return res.data;
    }

    __testUrl(url) {
        if (!url.endsWith('/')) {
            throw new Error(
                `Binder does not accept urls that do not have a trailing slash: ${url}`
            );
        }
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
            // TODO: I really dislike that this is comma separated and not an array.
            // We should fix this in the Binder API.
            with: model.__activeRelations.map(camelToSnake).join(',') || null,
        };
    }

    fetchModel({ url, data }) {
        return this.get(url, data).then(res => {
            return {
                data: res.data,
                repos: res.with,
                relMapping: res.with_mapping,
            };
        });
    }

    saveModel({ url, data, params, isNew }) {
        const method = isNew ? 'post' : 'patch';
        return this[method](url, data, { params })
            .then(newData => {
                return { data: newData };
            })
            .catch(err => {
                if (err.response) {
                    err.valErrors = parseBackendValidationErrors(err.response);
                }
                throw err;
            });
    }

    saveAllModels({ url, data }) {
        return this.put(url, {
            data: data.data,
            with: data.relations,
        }).then(res => {
            return {
                data: res.data && res.data.length > 0 ? res.data[0] : null,
                repos: res.with,
                relMapping: res.with_mapping,
            };
        });
    }

    deleteModel({ url, params }) {
        // TODO: kind of silly now, but we'll probably want better error handling soon.
        return this.delete(url, null, { params });
    }

    buildFetchStoreParams(store) {
        const offset = store.getPageOffset();
        return {
            with: store.__activeRelations.join(',') || null,
            limit: store.__state.limit,
            // Hide offset if zero so the request looks cleaner in DevTools.
            offset: offset || null,
        };
    }

    fetchStore({ url, data }) {
        return this.get(url, data).then(res => {
            return {
                data: res.data,
                repos: res.with,
                relMapping: res.with_mapping,
                totalRecords: res.meta.total_records,
            };
        });
    }
};

function checkMomentInstance(attr, value) {
    if (!moment.isMoment(value)) {
        throw new Error(`Attribute \`${attr}\` is not a moment instance.`);
    }
}

var Casts = {
    date: {
        parse(attr, value) {
            if (value === null) {
                return null;
            }
            return moment(value, 'YYYY-MM-DD');
        },
        toJS(attr, value) {
            if (value === null) {
                return null;
            }
            checkMomentInstance(attr, value);
            return value.format('YYYY-MM-DD');
        },
    },
    datetime: {
        parse(attr, value) {
            if (value === null) {
                return null;
            }
            return moment(value);
        },
        toJS(attr, value) {
            if (value === null) {
                return null;
            }
            checkMomentInstance(attr, value);
            return value.format();
        },
    },
    enum: expectedValues => {
        if (!isArray(expectedValues)) {
            throw new Error(
                'Invalid argument suplied to `Casts.enum`, expected an instance of array.'
            );
        }
        function checkExpectedValues(attr, value) {
            if (value === null) {
                return null;
            }
            if (expectedValues.includes(value)) {
                return value;
            }
            throw new Error(
                `Value set to attribute \`${attr}\`, ${JSON.stringify(value)}, is not one of the allowed enum: ${JSON.stringify(expectedValues)}`
            );
        }
        return {
            parse: checkExpectedValues,
            toJS: checkExpectedValues,
        };
    },
};

export { Model, Store, BinderApi, Casts };
