import axios from 'axios';
import { toJS, observable } from 'mobx';
import MockAdapter from 'axios-mock-adapter';
import _ from 'lodash';
import { Model } from '../';
import {
    Animal,
    AnimalStore,
    AnimalWithArray,
    AnimalWithObject,
    AnimalWithFrontendProp,
    AnimalWithoutApi,
    AnimalWithoutUrl,
    AnimalCircular,
    AnimalResourceName,
    KindResourceName,
    Kind,
    Breed,
    Person,
    PersonStore,
    Location,
} from './fixtures/Animal';
import { Customer, Location as CLocation } from './fixtures/Customer';
import animalKindBreedData from './fixtures/animal-with-kind-breed.json';
import animalsWithPastOwnersAndTownData from './fixtures/animals-with-past-owners-and-town.json';
import animalKindBreedDataNested from './fixtures/animal-with-kind-breed-nested.json';
import animalMultiPutResponse from './fixtures/animals-multi-put-response.json';
import animalMultiPutError from './fixtures/animals-multi-put-error.json';
import customersWithTownCookRestaurant from './fixtures/customers-with-town-cook-restaurant.json';
import customersLocationBestCookWorkPlaces from './fixtures/customers-location-best-cook-work-places.json';
import saveFailData from './fixtures/save-fail.json';
import saveNewFailData from './fixtures/save-new-fail.json';

beforeEach(() => {
    // Refresh lodash's `_.uniqueId` internal state for every test
    let idCounter = 0;
    _.uniqueId = jest.fn(() => {
        idCounter += 1;
        return idCounter;
    });
});

test('Initialize model with valid data', () => {
    const animal = new Animal({
        id: 2,
        name: 'Monkey',
    });

    expect(animal.id).toBe(2);
    expect(animal.name).toBe('Monkey');
});

test('Initialize model with invalid data', () => {
    const animal = new Animal({
        nonExistentProperty: 'foo',
    });

    expect(animal.nonExistentProperty).toBeUndefined();
});

test('Initialize model without data', () => {
    const animal = new Animal(null);

    expect(animal.id).toBeNull();
    expect(animal.name).toBe('');
});

test('Chaining parse', () => {
    const animal = new Animal().parse({});

    expect(animal).toBeInstanceOf(Animal);
});

test('`cid` should be a unique value`', () => {
    expect(new Animal().cid).toBe('m1');
    expect(new Animal().cid).toBe('m2');
});

test('primaryKey defined as not static should throw error', () => {
    class Zebra extends Model {
        primaryKey = 'blaat';
    }

    expect(() => {
        return new Zebra();
    }).toThrow('`primaryKey` should be a static property on the model.');
});

test('property defined as both attribute and relation should throw error', () => {
    class Zebra extends Model {
        @observable kind = '';

        relation() {
            return { kind: Kind };
        }
    }

    expect(() => {
        return new Zebra(null, { relations: ['kind'] });
    }).toThrow(
        'Cannot define `kind` as both an attribute and a relation. You probably need to remove the attribute.'
    );
});

test('initialize() method should be called', () => {
    const initMock = jest.fn();
    class Zebra extends Model {
        initialize() {
            initMock();
        }
    }

    new Zebra();
    expect(initMock.mock.calls.length).toBe(1);
});

test('URL should be correct without primary key', () => {
    const animal = new Animal();

    expect(animal.url).toBe('/api/animal/');
});

test('URL should be correct with primary key', () => {
    const animal = new Animal({ id: 2 });

    expect(animal.url).toBe('/api/animal/2/');
});

test('Relation should not be initialized by default', () => {
    const animal = new Animal();

    expect(animal.kind).toBeUndefined();
});

test('Initialize one-level relation', () => {
    const animal = new Animal(null, {
        relations: ['kind'],
    });

    expect(animal.kind).toBeInstanceOf(Kind);
});

test('isNew should be true for new model', () => {
    const animal = new Animal();

    expect(animal.isNew).toBe(true);
});

test('isNew should be false for existing model', () => {
    const animal = new Animal({ id: 2 });

    expect(animal.isNew).toBe(false);
});

test('Initialize two-level relation', () => {
    const animal = new Animal(null, {
        relations: ['kind.breed'],
    });

    expect(animal.kind).toBeInstanceOf(Kind);
    expect(animal.kind.breed).toBeInstanceOf(Breed);
});

test('Initialize three-level relation', () => {
    const animal = new Animal(null, {
        relations: ['kind.breed.location'],
    });

    expect(animal.kind).toBeInstanceOf(Kind);
    expect(animal.kind.breed).toBeInstanceOf(Breed);
    expect(animal.kind.breed.location).toBeInstanceOf(Location);
});

test('Initialize multiple relations', () => {
    const animal = new Animal(null, {
        relations: ['kind', 'owner'],
    });

    expect(animal.kind).toBeInstanceOf(Kind);
    expect(animal.owner).toBeInstanceOf(Person);
});

test('Initialize circular model', () => {
    const animal = new AnimalCircular(
        {
            id: 2,
            circular: {
                id: 3,
            },
        },
        { relations: ['circular'] }
    );

    expect(animal.id).toBe(2);
    expect(animal.circular).toBeInstanceOf(AnimalCircular);
    expect(animal.circular.circular).toBeUndefined();
    expect(animal.circular.id).toBe(3);
});

test('Initialize multiple nested relations', () => {
    const animal = new Animal(null, {
        relations: ['kind.breed', 'kind.location'],
    });

    expect(animal.kind.breed).toBeInstanceOf(Breed);
    expect(animal.kind.location).toBeInstanceOf(Location);
});

test('Attributes list', () => {
    const animal = new Animal();

    expect(animal.__attributes).toEqual(['id', 'name']);
});

test('Non-object given to parse() should throw an error', () => {
    expect(() => {
        const animal = new Animal();
        return animal.parse(1);
    }).toThrow('Parameter supplied to `parse()` is not an object, got: 1');
});

test('Non existent relation should throw an error', () => {
    expect(() => {
        return new Animal(null, {
            relations: ['ponyfoo'],
        });
    }).toThrow('Specified relation "ponyfoo" does not exist on model.');
});

test('Parsing two-level relation (with repos)', () => {
    const animal = new Animal(null, {
        relations: ['kind.breed'],
    });

    animal.fromBackend({
        data: animalKindBreedData.data,
        repos: animalKindBreedData.with,
        relMapping: animalKindBreedData.with_mapping,
    });

    expect(animal.id).toBe(1);
    expect(animal.name).toBe('Woofer');
    expect(animal.kind.id).toBe(4);
    expect(animal.kind.name).toBe('Good Dog');
    expect(animal.kind.breed.id).toBe(3);
    expect(animal.kind.breed.name).toBe('Good Pupper');
});

test('Parsing two times', () => {
    const animal = new Animal({
        id: 2,
    });

    animal.fromBackend({
        data: { name: 'Woofer' },
    });

    expect(animal.id).toBe(2);
    expect(animal.name).toBe('Woofer');
});

test('Parsing empty relation', () => {
    const customer = new CLocation({}, { relations: ['bestCook.currentWork'] });

    customer.fromBackend({
        data: customersLocationBestCookWorkPlaces.data,
        repos: customersLocationBestCookWorkPlaces.with,
        relMapping: customersLocationBestCookWorkPlaces.with_mapping,
    });

    expect(customer.bestCook.id).toBe(null);
});

test('Parsing two-level relation (nested)', () => {
    const animal = new Animal(null, {
        relations: ['kind.breed'],
    });

    animal.fromBackend({
        data: animalKindBreedDataNested.data,
    });

    expect(animal.id).toBe(1);
    expect(animal.name).toBe('Woofer');
    expect(animal.kind.id).toBe(4);
    expect(animal.kind.name).toBe('Good Dog');
    expect(animal.kind.breed.id).toBe(3);
    expect(animal.kind.breed.name).toBe('Good Pupper');
});

test('Parsing store relation (nested)', () => {
    const animal = new Animal(null, {
        relations: ['pastOwners'],
    });

    animal.fromBackend({
        data: animalKindBreedDataNested.data,
    });

    expect(animal.id).toBe(1);
    expect(animal.pastOwners.length).toBe(2);
    expect(animal.pastOwners.map('id')).toEqual([50, 51]);
});

test('Parsing two times with store relation', () => {
    const animal = new Animal(null, {
        relations: ['pastOwners'],
    });

    animal.pastOwners.parse([{ id: 3 }]);

    expect(animal.pastOwners.map('id')).toEqual([3]);

    animal.parse({
        name: 'Pupper',
    });

    expect(animal.pastOwners.map('id')).toEqual([3]);
});

test('Parsing store relation with model relation in it', () => {
    const animal = new Animal(null, {
        relations: ['pastOwners.town'],
    });

    expect(animal.pastOwners).not.toBeUndefined();
    expect(animal.pastOwners).toBeInstanceOf(PersonStore);

    animal.fromBackend({
        data: animalsWithPastOwnersAndTownData.data,
        repos: animalsWithPastOwnersAndTownData.with,
        relMapping: animalsWithPastOwnersAndTownData.with_mapping,
    });

    expect(animal.pastOwners.map('id')).toEqual([55, 66]);
    expect(animal.pastOwners.get(55).town).toBeInstanceOf(Location);
    expect(animal.pastOwners.get(55).town.id).toBe(10);
    expect(animal.pastOwners.get(55).town.name).toBe('Eindhoven');
    expect(animal.pastOwners.get(66).town.id).toBe(11);
    expect(animal.pastOwners.get(66).town.name).toBe('Breda');
});

test('Parsing Store -> Model -> Store relation', () => {
    const customer = new Customer(null, {
        relations: ['oldTowns.bestCook.workPlaces'],
    });

    customer.fromBackend({
        data: customersWithTownCookRestaurant.data,
        repos: customersWithTownCookRestaurant.with,
        relMapping: customersWithTownCookRestaurant.with_mapping,
    });

    expect(customer.oldTowns.at(0).bestCook.id).toBe(50);
    expect(customer.oldTowns.at(0).bestCook.workPlaces.map('id')).toEqual([
        5,
        6,
    ]);
});

test('toBackend with basic properties', () => {
    const animal = new Animal({
        id: 3,
        name: 'Donkey',
    });

    const serialized = animal.toBackend();

    expect(serialized).toEqual({
        id: 3,
        name: 'Donkey',
    });
});

test('toBackend with relations', () => {
    const animal = new Animal(
        {
            id: 4,
            name: 'Donkey',
        },
        { relations: ['kind', 'owner'] }
    );

    animal.kind.id = 8;

    const serialized = animal.toBackend();

    expect(serialized).toEqual({
        id: 4,
        name: 'Donkey',
        kind: 8,
        owner: null,
    });
});

test('toBackend with store relation', () => {
    const animal = new Animal(
        {
            id: 4,
        },
        { relations: ['pastOwners'] }
    );

    animal.pastOwners.parse([{ id: 5 }]);

    const serialized = animal.toBackend();

    expect(serialized).toEqual({
        id: 4,
        name: '',
        past_owners: [5],
    });
});

test('toBackendAll with model relation', () => {
    const animal = new Animal(
        {
            id: 4,
        },
        { relations: ['kind.breed', 'owner'] }
    );

    animal.kind.parse({ id: 5 });

    const serialized = animal.toBackendAll(null, {
        relations: ['kind.breed', 'owner'],
    });
    expect(serialized).toMatchSnapshot();
});

test('toBackendAll without relations', () => {
    const animal = new Animal(
        {
            id: 4,
        },
        { relations: ['kind.breed', 'owner'] }
    );

    animal.kind.parse({ id: 5 });
    // Purposefully pass no parameters to toBackendAll()
    const serialized = animal.toBackendAll();
    expect(serialized).toMatchSnapshot();
});

test('toBackendAll with partial relations', () => {
    const animal = new Animal(
        {
            name: 'Doggo',
            kind: { name: 'Dog' },
            owner: { name: 'Henk', town: { name: 'Ehv' } },
        },
        { relations: ['kind', 'owner.town'] }
    );
    const serialized = animal.toBackendAll(null, { relations: ['owner'] });
    expect(serialized).toMatchSnapshot();
});

test('Internal relation list should not contain duplicates', () => {
    // I really should not test internals, but this caused hard-to-find bugs in the past
    // so I want to be sure this works.
    const animal = new Animal({}, { relations: ['kind', 'kind.breed'] });

    expect(animal.__activeCurrentRelations).toEqual(['kind']);
});

test('toBackendAll with store relation', () => {
    const animal = new Animal({}, { relations: ['pastOwners'] });

    animal.pastOwners.parse([
        { name: 'Bar' },
        { name: 'Foo' },
        { id: 10, name: 'R' },
    ]);

    const serialized = animal.toBackendAll(null, { relations: ['pastOwners'] });
    expect(serialized).toMatchSnapshot();
});

test('toBackendAll should de-duplicate relations', () => {
    const animal = new Animal({}, { relations: ['pastOwners.town'] });

    animal.pastOwners.parse([{ name: 'Bar' }, { name: 'Foo' }]);

    // This is something you should never do, so maybe this is a bad test?
    const animalBar = animal.pastOwners.at(0);
    animal.pastOwners.models[1] = animalBar;

    // This isn't the real test, just a check.
    expect(animalBar.cid).toBe(animal.pastOwners.at(1).cid);

    const serialized = animal.toBackendAll(null, {
        relations: ['pastOwners.town'],
    });
    expect(serialized).toMatchSnapshot();
});

test('toBackendAll with deep nested relation', () => {
    // It's very important to test what happens when the same relation ('location') is used twice + is nested.
    const animal = new Animal(
        {},
        { relations: ['kind.location', 'kind.breed.location'] }
    );

    animal.kind.parse({
        name: 'Aap',
        location: { name: 'Apenheul' },
        breed: { name: 'MyBreed', location: { name: 'Amerika' } },
    });

    const serialized = animal.toBackendAll(null, {
        relations: ['kind.location', 'kind.breed.location'],
    });
    expect(serialized).toMatchSnapshot();
});

test('toBackendAll with nested store relation', () => {
    // It's very important to test what happens when the same relation ('location') is used twice + is nested.
    const animal = new Animal({}, { relations: ['pastOwners.town'] });

    animal.pastOwners.parse([
        {
            name: 'Henk',
            town: {
                name: 'Eindhoven',
            },
        },
        {
            name: 'Krol',
            town: {
                name: 'Breda',
            },
        },
    ]);

    const serialized = animal.toBackendAll(null, {
        relations: ['pastOwners.town'],
    });
    expect(serialized).toMatchSnapshot();
});

test('toBackendAll with `backendResourceName` property model', () => {
    const animal = new AnimalResourceName(
        {},
        { relations: ['blaat', 'owners', 'pastOwners'] }
    );

    animal.parse({
        id: 1,
        blaat: {
            id: 2,
        },
        owners: [
            {
                id: 3,
            },
        ],
        pastOwners: [
            {
                id: 4,
            },
        ],
    });

    const serialized = animal.toBackendAll(null, {
        relations: ['blaat', 'owners', 'pastOwners'],
    });
    expect(serialized).toMatchSnapshot();
});

test('backendResourceName defined as not static should throw error', () => {
    class Zebra extends Model {
        backendResourceName = 'blaat';
    }

    expect(() => {
        return new Zebra();
    }).toThrow(
        '`backendResourceName` should be a static property on the model.'
    );
});

test('Attribute already used by mobx-spine should throw error', () => {
    // E.g. the `url` property is used by mobx-spine, so you can't use it as an attribute.
    class Zebra extends Model {
        @observable url = '';
    }

    expect(() => {
        return new Zebra();
    }).toThrow('Forbidden attribute key used: `url`');
});

test('toBackend with frontend-only prop', () => {
    const animal = new AnimalWithFrontendProp({
        id: 3,
        _frontend: 'Donkey',
    });

    const serialized = animal.toBackend();

    expect(animal._frontend).toBe('Donkey');
    expect(serialized).toEqual({
        id: 3,
    });
});

test('toBackend with observable array', () => {
    const animal = new AnimalWithArray({
        foo: ['q', 'a'],
    });

    expect(animal.toBackend()).toEqual({
        foo: ['q', 'a'],
    });
});

test('clear with basic attribute', () => {
    const animal = new Animal({
        id: 2,
        name: 'Monkey',
    });

    animal.clear();

    expect(animal.id).toBe(null);
    expect(animal.name).toBe('');
});

test('clear with relations', () => {
    const animal = new Animal(
        {
            id: 5,
            name: 'Donkey kong',
        },
        { relations: ['kind', 'owner'] }
    );

    animal.kind.id = 8;

    animal.clear();

    expect(animal.kind.id).toBe(null);
});

test('clear with array attribute', () => {
    const animal = new AnimalWithArray();
    animal.foo.push('bar');

    expect(toJS(animal.foo)).toEqual(['bar']);

    animal.clear();

    expect(toJS(animal.foo)).toEqual([]);
});

test('clear with object attribute', () => {
    const animal = new AnimalWithObject();
    animal.foo.bar = true;

    expect(toJS(animal.foo)).toEqual({ bar: true });

    animal.clear();

    expect(toJS(animal.foo)).toEqual({});
});

test('toJS with basic attributes', () => {
    const animal = new Animal({
        id: 4,
        name: 'japser',
    });

    expect(animal.toJS()).toEqual({
        id: 4,
        name: 'japser',
    });
});

test('toJS with relations', () => {
    const animal = new Animal(
        {
            id: 4,
            name: 'japser',
            kind: { id: 8, breed: { id: 10 } },
        },
        { relations: ['kind.breed'] }
    );

    expect(animal.toJS()).toEqual({
        id: 4,
        name: 'japser',
        kind: {
            id: 8,
            name: '',
            breed: {
                id: 10,
                name: '',
            },
        },
    });
});

test('toJS with observable array', () => {
    const animal = new AnimalWithArray({
        foo: ['q', 'a'],
    });

    expect(animal.toJS()).toEqual({
        foo: ['q', 'a'],
    });
});

test('fetch without id', () => {
    const animal = new Animal();
    expect(() => animal.fetch()).toThrow('Trying to fetch model without id!');
});

test('delete without id and store', () => {
    const animal = new Animal();
    expect(animal.delete()).toBeInstanceOf(Promise);
});

test('fetch without api', () => {
    const animal = new AnimalWithoutApi({ id: 2 });
    expect(() => animal.fetch()).toThrow(
        'You are trying to perform a API request without an `api` property defined on the model.'
    );
});

test('fetch without url', () => {
    const animal = new AnimalWithoutUrl({ id: 2 });
    expect(() => animal.fetch()).toThrow(
        'You are trying to perform a API request without an `urlRoot` property defined on the model.'
    );
});

describe('requests', () => {
    let mock;
    beforeEach(() => {
        mock = new MockAdapter(axios);
    });
    afterEach(() => {
        if (mock) {
            mock.restore();
            mock = null;
        }
    });

    test('fetch with basic properties', () => {
        const animal = new Animal({ id: 2 });
        mock.onAny().replyOnce(config => {
            expect(config.url).toBe('/api/animal/2/');
            expect(config.method).toBe('get');
            expect(config.params).toEqual({ with: null });
            return [200, { data: { id: 2, name: 'Madagascar' } }];
        });

        return animal.fetch().then(() => {
            expect(animal.id).toBe(2);
        });
    });

    test('fetch with relations', () => {
        const animal = new Animal(
            { id: 2 },
            {
                relations: ['kind.breed'],
            }
        );
        mock.onAny().replyOnce(config => {
            expect(config.params).toEqual({
                with: 'kind.breed',
            });
            return [200, animalKindBreedData];
        });

        return animal.fetch().then(() => {
            expect(animal.id).toBe(1);
            expect(animal.kind.id).toBe(4);
            expect(animal.kind.breed.id).toBe(3);
        });
    });

    test('fetch with camelCased relations', () => {
        const animal = new Animal(
            { id: 2 },
            {
                relations: ['pastOwners'],
            }
        );
        mock.onAny().replyOnce(config => {
            expect(config.params).toEqual({
                with: 'past_owners',
            });
            return [200, animalsWithPastOwnersAndTownData];
        });

        return animal.fetch();
    });

    test('fetch with default params', () => {
        const animal = new Animal({ id: 2 });
        animal.setFetchParams({ projectId: 1 });
        mock.onAny().replyOnce(config => {
            expect(config.params).toEqual({
                with: null,
                projectId: 1,
            });
            return [200, {}];
        });

        return animal.fetch();
    });

    test('fetch with auto-generated URL', () => {
        const kind = new KindResourceName({ id: 2 });
        mock.onAny().replyOnce(config => {
            expect(config.url).toBe('/kind/2/');
            return [200, {}];
        });

        return kind.fetch();
    });

    test('save new with basic properties', () => {
        const animal = new Animal({ name: 'Doggo' });
        const spy = jest.spyOn(animal, 'saveFromBackend');
        mock.onAny().replyOnce(config => {
            expect(config.url).toBe('/api/animal/');
            expect(config.method).toBe('post');
            expect(config.data).toBe('{"id":null,"name":"Doggo"}');
            return [201, { id: 10, name: 'Doggo' }];
        });

        return animal.save().then(() => {
            expect(animal.id).toBe(10);
            expect(spy).toHaveBeenCalled();

            spy.mockReset();
            spy.mockRestore();
        });
    });

    test('save existing with basic properties', () => {
        const animal = new Animal({ id: 12, name: 'Burhan' });
        mock.onAny().replyOnce(config => {
            expect(config.method).toBe('patch');
            return [200, { id: 12, name: 'Burhan' }];
        });

        return animal.save().then(() => {
            expect(animal.id).toBe(12);
        });
    });

    test('save fail with basic properties', () => {
        const animal = new Animal({ name: 'Nope' });
        mock.onAny().replyOnce(400, saveFailData);

        return animal.save().catch(() => {
            const valErrors = toJS(animal.backendValidationErrors);
            expect(valErrors).toEqual({
                name: ['required'],
                kind: ['blank'],
            });
        });
    });

    test('save new model fail with basic properties', () => {
        const animal = new Animal({ name: 'Nope' });
        mock.onAny().replyOnce(400, saveNewFailData);

        return animal.save().catch(() => {
            const valErrors = toJS(animal.backendValidationErrors);
            expect(valErrors).toEqual({
                name: ['invalid'],
            });
        });
    });

    test('save fail with 500', () => {
        const animal = new Animal({ name: 'Nope' });
        mock.onAny().replyOnce(500, {});

        return animal.save().catch(() => {
            const valErrors = toJS(animal.backendValidationErrors);
            expect(valErrors).toEqual({});
        });
    });

    test('save with params', () => {
        const animal = new Animal();
        mock.onAny().replyOnce(config => {
            expect(config.params).toEqual({ branch_id: 1 });
            return [201, {}];
        });

        return animal.save({ params: { branch_id: 1 } });
    });

    test('save all with relations', () => {
        const animal = new Animal(
            { name: 'Doggo', kind: { name: 'Dog' } },
            { relations: ['kind'] }
        );
        const spy = jest.spyOn(animal, 'saveFromBackend');
        mock.onAny().replyOnce(config => {
            expect(config.url).toBe('/api/animal/');
            expect(config.method).toBe('put');
            return [201, animalMultiPutResponse];
        });

        return animal.saveAll({ relations: ['kind'] }).then(() => {
            expect(spy).toHaveBeenCalled();
            expect(animal.id).toBe(10);
            // FIXME
            // expect(animal.kind.id).toBe(4);

            spy.mockReset();
            spy.mockRestore();
        });
    });

    test('save all with validation errors', () => {
        const animal = new Animal(
            {
                name: 'Doggo',
                kind: { name: 'Dog' },
                pastOwners: [{ name: 'Jo', town: { id: 5, name: '' } }],
            },
            { relations: ['kind', 'pastOwners.town'] }
        );
        mock.onAny().replyOnce(config => {
            return [400, animalMultiPutError];
        });

        return animal.saveAll({ relations: ['kind'] }).then(
            () => {},
            err => {
                if (!err.response) {
                    throw err;
                }
                expect(toJS(animal.backendValidationErrors).name).toEqual([
                    'blank',
                ]);
                expect(toJS(animal.kind.backendValidationErrors).name).toEqual([
                    'required',
                ]);
                expect(
                    toJS(animal.pastOwners.at(0).backendValidationErrors).name
                ).toEqual(['required']);
                expect(
                    toJS(animal.pastOwners.at(0).town.backendValidationErrors)
                        .name
                ).toEqual(['maxlength']);
            }
        );
    });

    test('save all with existing model', () => {
        const animal = new Animal(
            { id: 10, name: 'Doggo', kind: { name: 'Dog' } },
            { relations: ['kind'] }
        );
        mock.onAny().replyOnce(config => {
            expect(config.url).toBe('/api/animal/');
            expect(config.method).toBe('put');
            const putData = JSON.parse(config.data);
            expect(putData).toMatchSnapshot();
            return [201, animalMultiPutResponse];
        });

        return animal.saveAll({ relations: ['kind'] });
    });

    test('save all with empty response from backend', () => {
        const animal = new Animal(
            { name: 'Doggo', kind: { name: 'Dog' } },
            { relations: ['kind'] }
        );
        mock.onAny().replyOnce(config => {
            return [201, {}];
        });

        return animal.saveAll();
    });

    test('save all fail', () => {
        const animal = new Animal({});
        mock.onAny().replyOnce(() => {
            return [500, {}];
        });

        const promise = animal.saveAll();
        expect(animal.isLoading).toBe(true);
        return promise.catch(() => {
            expect(animal.isLoading).toBe(false);
        });
    });

    test('delete existing with basic properties', () => {
        const animal = new Animal({ id: 12, name: 'Burhan' });
        mock.onAny().replyOnce(config => {
            expect(config.method).toBe('delete');
            expect(config.url).toBe('/api/animal/12/');
            return [204, null];
        });

        return animal.delete();
    });

    test('delete existing with basic properties and remove from store', () => {
        const animalStore = new AnimalStore().parse([
            { id: 12, name: 'Burhan' },
        ]);
        const animal = animalStore.at(0);
        mock.onAny().replyOnce(config => {
            return [204, null];
        });

        const promise = animal.delete();
        expect(animalStore.at(0)).toBeInstanceOf(Animal);
        return promise.then(() => {
            expect(animalStore.length).toBe(0);
        });
    });

    test('delete existing with basic properties and remove from store without immediate', () => {
        const animalStore = new AnimalStore().parse([
            { id: 12, name: 'Burhan' },
        ]);
        const animal = animalStore.at(0);
        mock.onAny().replyOnce(config => {
            return [204, null];
        });

        expect(animalStore.at(0)).toBeInstanceOf(Animal);
        const promise = animal.delete({ immediate: true });
        expect(animalStore.length).toBe(0);
        return promise;
    });

    test('delete with params', () => {
        const animal = new Animal({ id: 1 });
        mock.onAny().replyOnce(config => {
            expect(config.params).toEqual({ branch_id: 1 });
            return [204, null];
        });

        return animal.delete({ params: { branch_id: 1 } });
    });

    test('isLoading', () => {
        const animal = new Animal({ id: 2 });
        expect(animal.isLoading).toBe(false);
        mock.onAny().replyOnce(() => {
            expect(animal.isLoading).toBe(true);
            return [200, { id: 2 }];
        });

        return animal.fetch().then(() => {
            expect(animal.isLoading).toBe(false);
        });
    });
});
