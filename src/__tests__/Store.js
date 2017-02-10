import { Animal, AnimalStore, Breed, PersonStore } from './fixtures/Animal';
import animalsWithPastOwnersData from './fixtures/animals-with-past-owners.json';
import animalsWithKindBreedData from './fixtures/animals-with-kind-breed.json';
import animalsData from './fixtures/animals.json';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

const simpleData = [{
    id: 2,
    name: 'Monkey',
}, {
    id: 3,
    name: 'Boogie',
}, {
    id: 10,
    name: 'Jojo',
}];

test('Initialize store with valid data', () => {
    const animalStore = new AnimalStore();
    animalStore.parse(simpleData);

    expect(animalStore.length).toBe(3);
    expect(animalStore.models[0].id).toBe(2);
});

// TODO; I have no clue why this doesn't work.
xtest('Initialize store in constructor', () => {
    const animalStore = new AnimalStore(simpleData);
    expect(animalStore.length).toBe(3);
});

test('at model', () => {
    const animalStore = new AnimalStore();
    animalStore.parse(simpleData);

    const model = animalStore.at(1);
    expect(model.id).toBe(3);
});

test('at model (negative)', () => {
    const animalStore = new AnimalStore();
    animalStore.parse(simpleData);

    const model = animalStore.at(-1);
    expect(model.id).toBe(10);
});

test('Two level relation', () => {
    const animalStore = new AnimalStore(null, {
        relations: ['kind.breed'],
    });
    animalStore.parse(simpleData);

    const animal = animalStore.at(0);
    expect(animal.kind.breed).toBeInstanceOf(Breed);
});


test('get specific model', () => {
    const animalStore = new AnimalStore();
    animalStore.parse(simpleData);

    const model = animalStore.get(3);
    expect(model.id).toBe(3);
});

test('get specific model (loose)', () => {
    const animalStore = new AnimalStore();
    animalStore.parse(simpleData);

    const model = animalStore.get('3');
    expect(model.id).toBe(3);
});

test('map models', () => {
    const animalStore = new AnimalStore();
    animalStore.parse(simpleData);

    expect(animalStore.map('id')).toEqual([2, 3, 10]);
});

test('filter models', () => {
    const animalStore = new AnimalStore();
    animalStore.parse(simpleData);

    const models = animalStore.filter(['id', 3]);
    expect(models.length).toBe(1);
});

test('find model', () => {
    const animalStore = new AnimalStore();
    animalStore.parse(simpleData);

    const animal = animalStore.find({ name: 'Jojo' });
    expect(animal.id).toBe(10);
});

test('each model', () => {
    const animalStore = new AnimalStore();
    animalStore.parse(simpleData);
    const ids = [];

    animalStore.each((model) => {
        ids.push(model.id);
    });
    expect(ids).toEqual([2, 3, 10]);
});

test('remove one model', () => {
    const animalStore = new AnimalStore();
    animalStore.parse(simpleData);

    const model = animalStore.get(3);
    animalStore.remove(model);
    expect(animalStore.map('id')).toEqual([2, 10]);
});

test('remove multiple models', () => {
    const animalStore = new AnimalStore();
    animalStore.parse(simpleData);

    expect(animalStore.map('id')).toEqual([2, 3, 10]);
    const model1 = animalStore.get(3);
    const model2 = animalStore.get(10);
    animalStore.remove([model1, model2]);
    expect(animalStore.map('id')).toEqual([2]);
});

test('add one model', () => {
    const animalStore = new AnimalStore();
    animalStore.parse(simpleData);

    const model = animalStore.add({
        id: 20,
    });
    expect(animalStore.map('id')).toEqual([2, 3, 10, 20]);
    expect(model).toBeInstanceOf(Animal);
});

test('add multiple models', () => {
    const animalStore = new AnimalStore();
    animalStore.parse(simpleData);

    const models = animalStore.add([{
        id: 20,
    }, {
        id: 21,
    }]);
    expect(animalStore.map('id')).toEqual([2, 3, 10, 20, 21]);
    expect(models).toBeInstanceOf(Array);
    expect(models[0]).toBeInstanceOf(Animal);
});

test('clear models', () => {
    const animalStore = new AnimalStore();
    animalStore.parse(simpleData);

    expect(animalStore.length).toBe(3);
    animalStore.clear();
    expect(animalStore.length).toBe(0);
});

test('One-level store relation', () => {
    const animalStore = new AnimalStore(null, {
        relations: ['pastOwners'],
    });

    animalStore.fromBackend({
        data: animalsWithPastOwnersData.data,
        repos: animalsWithPastOwnersData.with,
        relMapping: animalsWithPastOwnersData.with_mapping,
    });

    expect(animalStore.at(0).pastOwners).toBeInstanceOf(PersonStore);
    expect(animalStore.get(2).pastOwners.map('id')).toEqual([2, 3]);
    expect(animalStore.get(3).pastOwners.map('id')).toEqual([1]);
});

test('toJS', () => {
    const animalStore = new AnimalStore();
    animalStore.parse([{ id: 2, name: 'Monkey' }]);
    expect(animalStore.toJS()).toEqual([{ id: 2, name: 'Monkey' }]);
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
        const animalStore = new AnimalStore();
        mock.onAny().replyOnce((config) => {
            expect(config.url).toBe('/api/animal/');
            expect(config.method).toBe('get');
            expect(config.params).toEqual({ with: null, limit: 25, offset: null });
            return [200, animalsData];
        });

        return animalStore.fetch()
        .then(() => {
            expect(animalStore.length).toBe(2);
            expect(animalStore.map('id')).toEqual([2, 3]);
        });
    });

    test('fetch with relations', () => {
        const animalStore = new AnimalStore(null, {
            relations: ['kind.breed'],
        });
        mock.onAny().replyOnce((config) => {
            expect(config.params).toEqual({ with: 'kind.breed', limit: 25, offset: null });
            return [200, animalsWithKindBreedData];
        });

        return animalStore.fetch()
        .then(() => {
            expect(animalStore.at(0).id).toBe(1);
            expect(animalStore.at(0).kind.id).toBe(4);
            expect(animalStore.at(0).kind.breed.id).toBe(3);
        });
    });

    test('isLoading', () => {
        const animalStore = new AnimalStore();
        expect(animalStore.isLoading).toBe(false);
        mock.onAny().replyOnce(() => {
            expect(animalStore.isLoading).toBe(true);
            return [200, animalsData];
        });

        return animalStore.fetch()
        .then(() => {
            expect(animalStore.isLoading).toBe(false);
        });
    });
});

