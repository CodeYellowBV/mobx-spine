import {
    observable,
    isObservable,
    extendObservable,
    isObservableArray,
    isObservableObject,
    computed,
    action,
    toJS,
} from 'mobx';
import {
    snakeCase,
    forIn,
    mapValues,
    find,
    get,
    isPlainObject,
    isArray,
    uniqueId,
} from 'lodash';
import snakeToCamel from './snakeToCamel';
import Store from './Store';

function generateNegativeId() {
    return -parseInt(uniqueId());
}

function concatInDict(dict, key, value) {
    dict[key] = dict[key] ? dict[key].concat(value) : value;
}

export default class Model {
    static primaryKey = 'id';
    // How the model is known at the backend. This is useful when the model is in a relation that has a different name.
    static backendResourceName = '';
    urlRoot;

    __attributes = [];
    // Holds original attributes with values, so `clear()` knows what to reset to (quite ugly).
    __originalAttributes = {};
    // Holds activated - nested - relations (e.g. `['animal', 'animal.breed']`)
    __activeRelations = [];
    // Holds activated - non-nested - relations (e.g. `['animal']`)
    __activeCurrentRelations = [];
    __repository;
    __store;
    api = null;
    // A `cid` can be used to identify the model locally.
    cid = `m${uniqueId()}`;
    @observable __backendValidationErrors = {};
    @observable __pendingRequestCount = 0;
    // URL query params that are added to fetch requests.
    @observable __fetchParams = {};

    @computed get url() {
        const id = this[this.constructor.primaryKey];
        return `${this.urlRoot}${id ? `${id}/` : ''}`;
    }

    @computed get isNew() {
        return !this[this.constructor.primaryKey];
    }

    @computed get isLoading() {
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

    @action __parseRelations(activeRelations) {
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

    @action fromBackend({ data, repos, relMapping }) {
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

    @action parse(data) {
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

    @action save(options = {}) {
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
                    this.fromBackend(res);
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

    @action saveAll(options = {}) {
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
                    this.fromBackend(res);
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

    // TODO: This is a bit hacky...
    @computed get backendValidationErrors() {
        return this.__backendValidationErrors;
    }

    @action delete(options = {}) {
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

    @action fetch(options = {}) {
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

    @action clear() {
        forIn(this.__originalAttributes, (value, key) => {
            this[key] = value;
        });

        this.__activeCurrentRelations.forEach(currentRel => {
            this[currentRel].clear();
        });
    }
}
