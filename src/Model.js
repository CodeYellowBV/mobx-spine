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
    each,
    forIn,
    mapValues,
    find,
    filter,
    get,
    isPlainObject,
    isArray,
    uniqueId,
} from 'lodash';
import Store from './Store';
import { invariant, snakeToCamel, camelToSnake } from './utils';

function generateNegativeId() {
    return -parseInt(uniqueId());
}

function concatInDict(dict, key, value) {
    dict[key] = dict[key] ? dict[key].concat(value) : value;
}

// TODO: find a way to get a list of existing properties automatically.
const FORBIDDEN_ATTRS = [
    'url',
    'urlRoot',
    'api',
    'isNew',
    'isLoading',
    'parse',
    'save',
    'clear',
];

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
        invariant(
            false,
            '`primaryKey` should be a static property on the model.'
        );
    }

    set backendResourceName(v) {
        invariant(
            false,
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
                invariant(
                    !FORBIDDEN_ATTRS.includes(key),
                    `Forbidden attribute key used: \`${key}\``
                );
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
            invariant(
                !this.__attributes.includes(currentRel),
                `Cannot define \`${currentRel}\` as both an attribute and a relation. You probably need to remove the attribute.`
            );
            if (!this.__activeCurrentRelations.includes(currentRel)) {
                this.__activeCurrentRelations.push(currentRel);
            }
        });
        extendObservable(
            this,
            mapValues(relModels, (otherRelNames, relName) => {
                const RelModel = relations[relName];
                invariant(
                    RelModel,
                    `Specified relation "${relName}" does not exist on model.`
                );
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

    // Many backends use snake_case for attribute names, so we convert to snake_case by default.
    toBackendAttrKey(attrKey) {
        return camelToSnake(attrKey);
    }

    // In the frontend we don't want to deal with those snake_case attr names.
    fromBackendAttrKey(attrKey) {
        return snakeToCamel(attrKey);
    }

    toBackend() {
        const output = {};
        this.__attributes.forEach(attr => {
            if (!attr.startsWith('_')) {
                output[this.toBackendAttrKey(attr)] = this.__toJSAttr(
                    attr,
                    this[attr]
                );
            }
        });
        // Add active relations as id.
        this.__activeCurrentRelations.forEach(currentRel => {
            const rel = this[currentRel];
            const relBackendName = this.toBackendAttrKey(currentRel);
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
            const relBackendName = this.toBackendAttrKey(currentRel);
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

    __parseRepositoryToData(key, repository) {
        if (isArray(key)) {
            return filter(repository, m => key.includes(m.id));
        }
        return find(repository, { id: key });
    }

    /**
     * We handle the fromBackend recursively.
     * But when recursing, we don't send the full repository, we need to only send the repo
     * relevant to the relation.
     *
     * So when we have a customer with a town.restaurants relation,
     * we get a "town.restaurants": "restaurant", relMapping from binder
     *
     * Here we create a scoped repository.
     * The root gets a `town.restaurants` repo, but the `town` relation only gets the `restaurants` repo
     */
    __scopeBackendResponse(data, targetRelName, repos, mapping) {
        let scopedData = null;
        let relevant = false;
        const scopedRepos = {};
        const scopedRelMapping = {};

        forIn(mapping, (repoName, relName) => {
            const repository = repos[repoName];
            relName = this.fromBackendAttrKey(relName);

            if (targetRelName === relName) {
                relevant = true;
                const relKey = data[this.toBackendAttrKey(relName)];
                scopedData = this.__parseRepositoryToData(relKey, repository);
                return;
            }

            if (relName.startsWith(targetRelName)) {
                // If we have town.restaurants and the targetRel = town
                // we need "restaurants" in the repository
                relevant = true;
                const relNames = relName.match(/([^.]+)\.(.+)/);
                const scopedRelName = relNames[2];
                scopedRepos[repoName] = repository;
                scopedRelMapping[scopedRelName] = repoName;
            }
        });

        if (!relevant) {
            return false;
        }

        return { scopedData, scopedRepos, scopedRelMapping };
    }

    // `data` contains properties for the current model.
    // `repos` is an object of "repositories". A repository is
    // e.g. "animal_kind", while the relation name would be "kind".
    // `relMapping` maps relation names to repositories.
    @action fromBackend({ data, repos, relMapping }) {
        // We handle the fromBackend recursively. On each relation of the source model
        // fromBackend gets called as well, but with data scoped for itself
        //
        // So when we have a model with a `town.restaurants.chef` relation,
        // we call fromBackend on the `town` relation.
        each(this.__activeCurrentRelations, relName => {
            const rel = this[relName];
            const resScoped = this.__scopeBackendResponse(
                data,
                relName,
                repos,
                relMapping
            );

            // Make sure we don't parse every relation for nothing
            if (!resScoped) {
                return;
            }
            const { scopedData, scopedRepos, scopedRelMapping } = resScoped;
            rel.fromBackend({
                data: scopedData,
                repos: scopedRepos,
                relMapping: scopedRelMapping,
            });
        });

        // Now all repositories are set on the relations, start parsing the actual data.
        // `parse()` will recursively fill in all relations.
        if (data) {
            this.parse(data);
        }
    }

    __getApi() {
        invariant(
            this.api,
            'You are trying to perform a API request without an `api` property defined on the model.'
        );
        invariant(
            this.urlRoot,
            'You are trying to perform a API request without an `urlRoot` property defined on the model.'
        );
        return this.api;
    }

    @action parse(data) {
        invariant(
            isPlainObject(data),
            'Parameter supplied to parse() is not an object.'
        );
        forIn(data, (value, key) => {
            const attr = this.fromBackendAttrKey(key);
            if (this.__attributes.includes(attr)) {
                this[attr] = this.__parseAttr(attr, value);
            } else if (this.__activeCurrentRelations.includes(attr)) {
                // In Binder, a relation property is an `int` or `[int]`, referring to its ID.
                // However, it can also be an object if there are nested relations (non flattened).
                if (isPlainObject(value) || isPlainObject(get(value, '[0]'))) {
                    this[attr].parse(value);
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
    @computed get backendValidationErrors() {
        return this.__backendValidationErrors;
    }

    @action delete(options = {}) {
        const removeFromStore = () =>
            this.__store ? this.__store.remove(this) : null;
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
        invariant(!this.isNew, 'Trying to fetch model without id!');
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
