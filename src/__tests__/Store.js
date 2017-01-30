import { AnimalStore, Breed, PersonStore } from './fixtures/Animal';
import animalsWithPastOwnersData from './fixtures/animals-with-past-owners.json';

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
    animalStore.replace({ data: simpleData });

    expect(animalStore.length).toBe(3);
    expect(animalStore.models[0].id).toBe(2);
});

test('at model', () => {
    const animalStore = new AnimalStore();
    animalStore.replace({ data: simpleData });

    const model = animalStore.at(1);
    expect(model.id).toBe(3);
});

test('at model (negative)', () => {
    const animalStore = new AnimalStore();
    animalStore.replace({ data: simpleData });

    const model = animalStore.at(-1);
    expect(model.id).toBe(10);
});

test('Two level relation', () => {
    const animalStore = new AnimalStore(null, {
        relations: ['kind.breed'],
    });
    animalStore.replace({ data: simpleData });

    const animal = animalStore.at(0);
    expect(animal.kind.breed).toBeInstanceOf(Breed);
});


test('get specific model', () => {
    const animalStore = new AnimalStore();
    animalStore.replace({ data: simpleData });

    const model = animalStore.get(3);
    expect(model.id).toBe(3);
});

test('get specific model (loose)', () => {
    const animalStore = new AnimalStore();
    animalStore.replace({ data: simpleData });

    const model = animalStore.get('3');
    expect(model.id).toBe(3);
});

test('map models', () => {
    const animalStore = new AnimalStore();
    animalStore.replace({ data: simpleData });

    expect(animalStore.map('id')).toEqual([2, 3, 10]);
});

test('filter models', () => {
    const animalStore = new AnimalStore();
    animalStore.replace({ data: simpleData });

    const models = animalStore.filter(['id', 3]);
    expect(models.length).toBe(1);
});

test('find model', () => {
    const animalStore = new AnimalStore();
    animalStore.replace({ data: simpleData });

    const animal = animalStore.find({ name: 'Jojo' });
    expect(animal.id).toBe(10);
});

test('remove one model', () => {
    const animalStore = new AnimalStore();
    animalStore.replace({ data: simpleData });

    const model = animalStore.get(3);
    animalStore.remove(model);
    expect(animalStore.map('id')).toEqual([2, 10]);
});

test('remove multiple models', () => {
    const animalStore = new AnimalStore();
    animalStore.replace({ data: simpleData });

    expect(animalStore.map('id')).toEqual([2, 3, 10]);
    const model1 = animalStore.get(3);
    const model2 = animalStore.get(10);
    animalStore.remove([model1, model2]);
    expect(animalStore.map('id')).toEqual([2]);
});

test('clear models', () => {
    const animalStore = new AnimalStore();
    animalStore.replace({ data: simpleData });

    expect(animalStore.length).toBe(3);
    animalStore.clear();
    expect(animalStore.length).toBe(0);
});

test('One-level store relation', () => {
    const animalStore = new AnimalStore(null, {
        relations: ['past_owners'],
    });

    animalStore.replace({
        data: animalsWithPastOwnersData.data,
        repos: animalsWithPastOwnersData.with,
        relMapping: animalsWithPastOwnersData.with_mapping,
    });

    expect(animalStore.at(0).past_owners).toBeInstanceOf(PersonStore);
    expect(animalStore.get(2).past_owners.map('id')).toEqual([2, 3]);
    expect(animalStore.get(3).past_owners.map('id')).toEqual([1]);
});
