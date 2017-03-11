import { observable, isObservable, extendObservable, computed, action, toJS } from 'mobx';
import { snakeCase, forIn, mapValues, find, get, isPlainObject } from 'lodash';
import snakeToCamel from './snakeToCamel';
import Store from './Store';

export default class Model {
    // TODO: Find out why `static primaryKey` doesn't work. I WANT IT STATIC GODDAMMIT.
    primaryKey = 'id';
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
    @observable __backendValidationErrors = {};
    @observable __pendingRequestCount = 0;

    @computed get url() {
        const id = this[this.primaryKey];
        return `${this.urlRoot}${id ? `${id}/` : ''}`;
    }

    @computed get isNew() {
        return !this[this.primaryKey];
    }

    @computed get isLoading() {
        return this.__pendingRequestCount > 0;
    }

    constructor(data, options = {}) {
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

    @action __parseRelations(activeRelations) {
        this.__activeRelations = activeRelations;
        // TODO: No idea why getting the relations only works when it's a Function.
        const relations = this.relations && this.relations();
        const relModels = {};
        activeRelations.forEach((aRel) => {
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
                relations: otherRelNames,
            });
        }));
    }

    toBackend() {
        const output = {};
        this.__attributes.forEach((attr) => {
            if (!attr.startsWith('_')) {
                output[snakeCase(attr)] = toJS(this[attr]);
            }
        });
        // Add active relations as id.
        this.__activeCurrentRelations.forEach((currentRel) => {
            const rel = this[currentRel];
            const relBackendName = snakeCase(currentRel);
            if (rel instanceof Model) {
                output[relBackendName] = rel[rel.primaryKey];
            }
            if (rel instanceof Store) {
                // TODO: This should use the `primaryKey` of the model in the store instead, not hardcoded the `id`.
                output[relBackendName] = rel.mapByPrimaryKey();
            }
        });
        return output;
    }

    toJS() {
        const output = {};
        this.__attributes.forEach((attr) => {
            output[attr] = toJS(this[attr]);
        });

        this.__activeCurrentRelations.forEach((currentRel) => {
            const model = this[currentRel];
            if (model) {
                output[currentRel] = model.toJS();
            }
        });
        return output;
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
            const model = get(this, snakeToCamel(relName));
            model.__repository = repository;
        });

        // Now all repositories are set on the relations, start parsing the actual data.
        // `parse()` will recursively fill in all relations.
        if (data) {
            this.parse(data);
        }
    }

    __getApi() {
        if (!this.api) {
            throw new Error('You are trying to perform a API request without an `api` property defined on the model.');
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

    @action save() {
        this.__backendValidationErrors = {};
        this.__pendingRequestCount += 1;
        // TODO: Allow data from an argument to be saved?
        return this.__getApi().saveModel({
            url: this.url,
            data: this.toBackend(),
            isNew: !!this[this.primaryKey],
        })
        .then(action((res) => {
            this.__pendingRequestCount -= 1;
            this.fromBackend(res);
        }))
        .catch(action((err) => {
            this.__pendingRequestCount -= 1;
            if (err.valErrors) {
                this.__backendValidationErrors = err.valErrors;
            }
            throw err;
        }));
    }

    // TODO: This is a bit hacky...
    @computed get backendValidationErrors() {
        return this.__backendValidationErrors;
    }

    @action delete() {
        // TODO: currently this always does a optimistic delete (meaning it doesn't wait on the request)
        // Do we want a non-optimistic delete?
        if (this.__store) {
            this.__store.remove(this);
        }
        if (this[this.primaryKey]) {
            this.__pendingRequestCount += 1;
            return this.__getApi().deleteModel({ url: this.url })
            .then(action(() => {
                this.__pendingRequestCount -= 1;
            }));
        }
        return Promise.resolve();
    }

    @action fetch(options = {}) {
        // TODO: I feel like we should give a clear error message when `urlRoot` is not defined.
        if (!this[this.primaryKey]) {
            throw new Error('Trying to fetch model without id!');
        }
        this.__pendingRequestCount += 1;
        const data = Object.assign(this.__getApi().buildFetchModelParams(this), options.data);
        return this.__getApi().fetchModel({ url: this.url, data })
        .then(action((res) => {
            this.fromBackend(res);
            this.__pendingRequestCount -= 1;
        }));
    }

    @action clear() {
        forIn(this.__originalAttributes, (value, key) => {
            this[key] = value;
        });

        this.__activeCurrentRelations.forEach((currentRel) => {
            this[currentRel].clear();
        });
    }
}
