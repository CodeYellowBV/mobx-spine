import { Kind, Person, PersonStore } from './fixtures/Animal';
import { observable } from 'mobx';
import Model from '../Model';
import { BinderApi } from '../index';

class Animal extends Model {
    urlRoot = '/api/animal/';
    api = new BinderApi();
    static backendResourceName = 'animal';
    @observable id = null;
    @observable name = '';

    @observable kind = this.relation(Kind);

    @observable owner = this.relation(Person);

    @observable pastOwner = this.relation(PersonStore)

    @observable father = this.relation(Animal)
}

describe('Model with new way of defining relations', () => {
    test('Initialize model with valid data', () => {
        new Animal({})
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

    test('Initialize multiple relations', () => {
        const animal = new Animal(null, {
            relations: ['kind', 'owner'],
        });

        expect(animal.kind).toBeInstanceOf(Kind);
        expect(animal.owner).toBeInstanceOf(Person);
    });

    test('Non existent relation should throw an error', () => {
        expect(() => {
            return new Animal(null, {
                relations: ['ponyfoo'],
            });
        }).toThrow('Specified relation "ponyfoo" does not exist on model.');
    });

    test('Can have a relation to itself', () => {
        const animal = new Animal(null, {
            relations: ['father'],
        });

        expect(animal.father).toBeInstanceOf(Animal);
    })

    test('Can have nested relations to itself', () => {
        const animal = new Animal(null, {
            relations: ['father.father'],
        });

        expect(animal.father.father).toBeInstanceOf(Animal);
    })

})



