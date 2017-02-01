import { Animal, Kind, Breed, Person, Location } from './fixtures/Animal';
import animalKindBreedData from './fixtures/animal-with-kind-breed.json';
import saveFailData from './fixtures/save-fail.json';
import axios from 'axios';
import { toJS } from 'mobx';
import MockAdapter from 'axios-mock-adapter';

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

test('Initialize multiple nested relations', () => {
    const animal = new Animal(null, {
        relations: ['kind.breed', 'kind.location'],
    });

    expect(animal.kind.breed).toBeInstanceOf(Breed);
    expect(animal.kind.location).toBeInstanceOf(Location);
});

test('Attributes list', () => {
    const animal = new Animal();

    expect(animal._attributes).toEqual(['id', 'name']);
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
    const animal = new Animal({
        id: 4,
        name: 'Donkey',
    }, { relations: ['kind', 'owner'] });

    animal.kind.id = 8;

    const serialized = animal.toBackend();

    expect(serialized).toEqual({
        id: 4,
        name: 'Donkey',
        kind: 8,
        owner: null,
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
    const animal = new Animal({
        id: 5,
        name: 'Donkey kong',
    }, { relations: ['kind', 'owner'] });

    animal.kind.id = 8;

    animal.clear();

    expect(animal.kind.id).toBe(null);
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
        mock.onAny().replyOnce((config) => {
            expect(config.url).toBe('/api/animal/2/');
            expect(config.method).toBe('get');
            expect(config.params).toEqual({ with: null });
            return [200, { data: { id: 2, name: 'Madagascar' } }];
        });

        return animal.fetch()
        .then(() => {
            expect(animal.id).toBe(2);
        });
    });

    test('fetch with relations', () => {
        const animal = new Animal({ id: 2 }, {
            relations: ['kind.breed'],
        });
        mock.onAny().replyOnce((config) => {
            expect(config.params).toEqual({
                with: 'kind.breed',
            });
            return [200, animalKindBreedData];
        });

        return animal.fetch()
        .then(() => {
            expect(animal.id).toBe(1);
            expect(animal.kind.id).toBe(4);
            expect(animal.kind.breed.id).toBe(3);
        });
    });

    test('save new with basic properties', () => {
        const animal = new Animal({ name: 'Doggo' });
        mock.onAny().replyOnce((config) => {
            expect(config.url).toBe('/api/animal/');
            expect(config.method).toBe('post');
            expect(config.data).toBe('{"name":"Doggo"}');
            return [201, { id: 10, name: 'Doggo' }];
        });

        return animal.save()
        .then(() => {
            expect(animal.id).toBe(10);
        });
    });

    test('save existing with basic properties', () => {
        const animal = new Animal({ id: 12, name: 'Burhan' });
        mock.onAny().replyOnce((config) => {
            expect(config.method).toBe('patch');
            return [200, { id: 12, name: 'Burhan' }];
        });

        return animal.save()
        .then(() => {
            expect(animal.id).toBe(12);
        });
    });

    test('save fail with basic properties', () => {
        const animal = new Animal({ name: 'Nope' });
        mock.onAny().replyOnce(400, saveFailData);

        return animal.save()
        .catch(() => {
            const valErrors = toJS(animal.backendValidationErrors);
            expect(valErrors).toEqual({
                name: ['This field cannot be blank.'],
                kind: ['This field cannot be null.'],
            });
        });
    });

    test('delete existing with basic properties', () => {
        const animal = new Animal({ id: 12, name: 'Burhan' });
        mock.onAny().replyOnce((config) => {
            expect(config.method).toBe('delete');
            expect(config.url).toBe('/api/animal/12/');
            return [204, null];
        });

        return animal.delete();
    });
});

