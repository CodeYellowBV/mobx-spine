import { observable, isObservable, extendObservable, computed, action } from 'mobx';
import request from './request';
import {
    mapKeys, camelCase, snakeCase, forIn, mapValues, find, get, isPlainObject,
} from 'lodash';

// TODO: need to find a good place for this
function parseBackendValidationErrors(response) {
    const valErrors = get(response, 'data.error.validation_errors');
    if (response.status === 400 && valErrors) {
        const camelCasedErrors = mapKeys(valErrors, (value, key) => camelCase(key));
        return mapValues(camelCasedErrors, (valError) => {
            return valError.map(obj => obj.code);
        });
    }
    return false;
}

export default class Model {
    // TODO: Find out why `static primaryKey` doesn't work. I WANT IT STATIC GODDAMMIT.
    primaryKey = 'id';
    urlRoot;

    _attributes = [];
    // Holds original attributes with values, so `clear()` knows what to reset to (quite ugly).
    _originalAttributes = {};
    // Holds activated - nested - relations (e.g. `['animal', 'animal.breed']`)
    _activeRelations = [];
    // Holds activated - non-nested - relations (e.g. `['animal']`)
    _activeCurrentRelations = [];
    _repository;
    _store;
    @observable _backendValidationErrors = {};
    @observable _pendingRequestCount = 0;

    @computed get url() {
        const id = this[this.primaryKey];
        return `${this.urlRoot}${id ? `${id}/` : ''}`;
    }

    @computed get isNew() {
        return !this[this.primaryKey];
    }

    @computed get isLoading() {
        return this._pendingRequestCount > 0;
    }

    constructor(data, options = {}) {
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

    @action parseRelations(activeRelations) {
        this._activeRelations = activeRelations;
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
            this._activeCurrentRelations.push(currentRel);
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

    // Return the fetch params for including relations on the backend.
    parseRelationParams() {
        return {
            with: this._activeRelations.join(',') || null,
        };
    }

    toBackend() {
        const output = {};
        this._attributes.forEach((attr) => {
            output[snakeCase(attr)] = this[attr];
        });
        // Add active relations as id.
        this._activeCurrentRelations.forEach((currentRel) => {
            const model = this[currentRel];
            if (model) {
                output[snakeCase(currentRel)] = model[model.primaryKey];
            }
        });
        return output;
    }

    toJS() {
        const output = {};
        this._attributes.forEach((attr) => {
            output[attr] = this[attr];
        });

        this._activeCurrentRelations.forEach((currentRel) => {
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
            const model = get(this, relName);
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

    @action parse(data) {
        // TODO: This makes the keys all in camelCase. Can't we force this on the backend?
        const formattedData = mapKeys(data, (value, key) => camelCase(key));

        this._attributes.forEach((attr) => {
            if (formattedData[attr] !== undefined) {
                this[attr] = formattedData[attr];
            }
        });

        this._activeCurrentRelations.forEach((currentRel) => {
            // In Binder, a relation property is an `int` or `[int]`, referring to its ID.
            // However, it can also be an object if there are nested relations (non flattened).
            if (isPlainObject(data[currentRel])) {
                this[currentRel].parse(data[currentRel]);
            } else {
                this[currentRel].addFromRepository(data[currentRel]);
            }
        });
    }

    @action save() {
        this._backendValidationErrors = {};
        this._pendingRequestCount += 1;
        // TODO: Allow data from an argument to be saved?
        const method = this[this.primaryKey] ? 'patch' : 'post';
        return request[method](this.url, this.toBackend())
        .then(action((data) => {
            this._pendingRequestCount -= 1;
            this.parse(data);
        }))
        .catch(action((err) => {
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
    @computed get backendValidationErrors() {
        return this._backendValidationErrors;
    }

    @action delete() {
        // TODO: currently this always does a optimistic delete (meaning it doesn't wait on the request)
        // Do we want a non-optimistic delete?
        if (this._store) {
            this._store.remove(this);
        }
        if (this[this.primaryKey]) {
            this._pendingRequestCount += 1;
            return request.delete(this.url)
            .then(action(() => {
                this._pendingRequestCount -= 1;
            }));
        }
        return null;
    }

    @action fetch(options = {}) {
        // TODO: I feel like we should give a clear error message when `urlRoot` is not defined.
        if (!this[this.primaryKey]) {
            throw new Error('Trying to fetch model without id!');
        }
        this._pendingRequestCount += 1;
        const data = Object.assign(this.parseRelationParams(), options.data);
        return request.get(this.url, data)
        .then(action((res) => {
            this._pendingRequestCount -= 1;

            this.fromBackend({
                data: res.data,
                repos: res.with,
                relMapping: res.with_mapping,
            });
        }));
    }

    @action clear() {
        forIn(this._originalAttributes, (value, key) => {
            this[key] = value;
        });

        this._activeCurrentRelations.forEach((currentRel) => {
            this[currentRel].clear();
        });
    }
}
