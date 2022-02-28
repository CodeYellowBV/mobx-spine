import { observable } from 'mobx';
import { Model, Store, BinderApi } from '../..';

export class Location extends Model {
    static backendResourceName = 'location';
    @observable id = null;
    @observable name = '';
}

export class File extends Model {
    urlRoot = '/api/file/';
    api = new BinderApi();
    static backendResourceName = 'file';
    @observable id = null;
    @observable dataFile = null;
}

export class FileStore extends Store {
    Model = File
}

export class FileCabinet extends Model {
    urlRoot = '/api/file_cabinet/';
    api = new BinderApi();
    static backendResourceName = 'file_cabinet';
    @observable id = null;

    relations() {
        return {
            files: FileStore,
        }
    }
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
    static backendResourceName = 'person';
    api = new BinderApi();
    @observable id = null;
    @observable name = '';

    relations() {
        return {
            town: Location,
            pets: AnimalStore,
        };
    }
}

export class PersonStore extends Store {
    Model = Person;
}

export class Kind extends Model {
    static backendResourceName = 'kind';
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
    api = new BinderApi();
    static backendResourceName = 'animal';
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
    api = new BinderApi();
    url = '/api/animal/';
}

export class AnimalStoreWithUrlFunction extends Store {
    Model = Animal;
    api = new BinderApi();
    randomId = 1;
    url() {
        return `/api/animal/${this.randomId}/`;
    }
}

// I have no creativity left after 17h, sorry. Also ssssh.
export class AnimalWithArray extends Model {
    @observable foo = [];
}

export class AnimalWithObject extends Model {
    @observable foo = {};
}

export class AnimalWithFrontendProp extends Model {
    @observable id = null;
    @observable _frontend = null;
}

export class AnimalWithoutApi extends Model {
    @observable id = null;
}

export class AnimalStoreWithoutApi extends Store {
    Model = Animal;
}

export class AnimalWithoutUrl extends Model {
    api = new BinderApi();
    @observable id = null;
}

export class AnimalStoreWithoutUrl extends Store {
    api = new BinderApi();
    Model = Animal;
}

export class AnimalCircular extends Model {
    @observable id = null;

    relations() {
        return {
            circular: AnimalCircular,
        };
    }
}

export class KindResourceName extends Model {
    api = new BinderApi();
    static backendResourceName = 'kind';
    @observable id = null;
}

export class PersonStoreResourceName extends Store {
    Model = KindResourceName;
    static backendResourceName = 'person';
    api = new BinderApi();
}

export class AnimalResourceName extends Model {
    api = new BinderApi();
    @observable id = null;

    relations() {
        return {
            blaat: KindResourceName,
            owners: PersonStoreResourceName,
            pastOwners: PersonStoreResourceName,
        };
    }
}
