import axios from 'axios';
import { toJS } from 'mobx';
import MockAdapter from 'axios-mock-adapter';
import _ from 'lodash';
import { Model } from '../';
import {
    Animal,
    AnimalStore,
    AnimalWithArray,
    AnimalWithFrontendProp,
    AnimalWithoutApi,
    AnimalWithoutUrl,
    AnimalCircular,
    Kind,
    Breed,
    Person,
    PersonStore,
    Location,
} from './fixtures/Animal';
import animalKindBreedData from './fixtures/animal-with-kind-breed.json';
import animalsWithPastOwnersAndTownData
    from './fixtures/animals-with-past-owners-and-town.json';
import animalKindBreedDataNested
    from './fixtures/animal-with-kind-breed-nested.json';
import animalMultiPutResponse from './fixtures/animals-multi-put-response.json';
import saveFailData from './fixtures/save-fail.json';

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

test('primaryKey defined as not static should throw error', () => {
    class Zebra extends Model {
        primaryKey = 'blaat';
    }

    expect(() => {
        return new Zebra();
    }).toThrow('`primaryKey` should be a static property on the model.');
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
    }).toThrow('Parameter supplied to parse() is not an object.');
});

test('Non existent relation should throw an error', () => {
    expect(() => {
        return new Animal(null, {
            relations: ['ponyfoo'],
        });
    }).toThrow('Specified relation "ponyfoo" does not exist on model.');
});

test('Parsing two-level relation', () => {
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

xtest('Parsing store relation with model relation in it', () => {
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

    expect(animal.pastOwners.map('id')).toBe([55, 66]);
    expect(animal.pastOwners.get(55).town).toBeInstanceOf(Location);
    expect(animal.pastOwners.get(55).town.id).toBe(11);
    expect(animal.pastOwners.get(66).town.id).toBe(11);
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

    const serialized = animal.toBackendAll();

    expect(serialized).toEqual({
        data: [
            {
                id: 4,
                kind: 5,
                name: '',
                owner: -2,
            },
        ],
        relations: {
            kind: [
                {
                    id: 5,
                    name: '',
                    breed: -1,
                },
            ],
            breed: [
                {
                    id: -1,
                    name: '',
                },
            ],
            owner: [
                {
                    id: -2,
                    name: '',
                },
            ],
        },
    });
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

    const serialized = animal.toBackendAll();

    expect(serialized).toEqual({
        data: [
            {
                id: -1,
                name: '',
                past_owners: [-2, -3, 10],
            },
        ],
        relations: {
            past_owners: [
                {
                    id: -2,
                    name: 'Bar',
                },
                {
                    id: -3,
                    name: 'Foo',
                },
                {
                    id: 10,
                    name: 'R',
                },
            ],
        },
    });
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

    const serialized = animal.toBackendAll();

    expect(serialized).toEqual({
        data: [
            {
                id: -1,
                name: '',
                kind: -2,
            },
        ],
        relations: {
            kind: [
                {
                    id: -2,
                    name: 'Aap',
                    breed: -4,
                    location: -3,
                },
            ],
            breed: [
                {
                    id: -4,
                    name: 'MyBreed',
                    location: -5,
                },
            ],
            location: [
                {
                    id: -3,
                    name: 'Apenheul',
                },
                {
                    id: -5,
                    name: 'Amerika',
                },
            ],
        },
    });
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

    const serialized = animal.toBackendAll();

    expect(serialized).toEqual({
        data: [
            {
                id: -1,
                name: '',
                past_owners: [-2, -3],
            },
        ],
        relations: {
            past_owners: [
                {
                    id: -2,
                    name: 'Henk',
                    town: -4,
                },
                {
                    id: -3,
                    name: 'Krol',
                    town: -5,
                },
            ],
            town: [
                {
                    id: -4,
                    name: 'Eindhoven',
                },
                {
                    id: -5,
                    name: 'Breda',
                },
            ],
        },
    });
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

test('clear with basic properties', () => {
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

test('toJS with basic properties', () => {
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

    test('save new with basic properties', () => {
        const animal = new Animal({ name: 'Doggo' });
        mock.onAny().replyOnce(config => {
            expect(config.url).toBe('/api/animal/');
            expect(config.method).toBe('post');
            expect(config.data).toBe('{"id":null,"name":"Doggo"}');
            return [201, { id: 10, name: 'Doggo' }];
        });

        return animal.save().then(() => {
            expect(animal.id).toBe(10);
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
                name: ['This field cannot be blank.'],
                kind: ['This field cannot be null.'],
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

    test('save all with relations', () => {
        const animal = new Animal(
            { name: 'Doggo', kind: { name: 'Dog' } },
            { relations: ['kind'] }
        );
        mock.onAny().replyOnce(config => {
            expect(config.url).toBe('/api/animal/');
            expect(config.method).toBe('put');
            return [201, animalMultiPutResponse];
        });

        return animal.saveAll().then(() => {
            expect(animal.id).toBe(10);
            expect(animal.kind.id).toBe(4);
        });
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
            expect(putData).toEqual({
                data: [
                    {
                        id: 10,
                        kind: -1,
                        name: 'Doggo',
                    },
                ],
                with: {
                    kind: [
                        {
                            id: -1,
                            name: 'Dog',
                        },
                    ],
                },
            });
            return [201, animalMultiPutResponse];
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
            expect(animalStore.at(0)).toBeUndefined();
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
        expect(animalStore.at(0)).toBeUndefined();
        return promise;
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
