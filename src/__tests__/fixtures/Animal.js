import { Model, Store } from '../..';
import { observable } from 'mobx';

export class Location extends Model {
    @observable id = null;
    @observable name = '';
}

export class Breed extends Model {
    @observable id = null;
    @observable name = '';

    relations() {
        return {
            location: Location,
        };
    }
}

export class Person extends Model {
    @observable id = null;
    @observable name = '';
}

export class PersonStore extends Store {
    Model = Person;
}

export class Kind extends Model {
    @observable id = null;
    @observable name = '';

    relations() {
        return {
            breed: Breed,
            location: Location,
        };
    }
}

export class Animal extends Model {
    urlRoot = '/api/animal/';
    @observable id = null;
    @observable name = '';

    relations() {
        return {
            kind: Kind,
            owner: Person,
            pastOwners: PersonStore,
        };
    }
}

export class AnimalStore extends Store {
    Model = Animal;
    url = '/api/animal/';
}
