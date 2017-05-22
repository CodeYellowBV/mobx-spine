import { observable } from 'mobx';
import { Model, Store, BinderApi } from '../..';

export class Cook extends Model {
    @observable id = null;
    @observable name = '';
    @observable profession = 'chef';
}

export class Restaurant extends Model {
    @observable id = null;
    @observable name = '';

    relations() {
        return {
            chef: Cook,
        };
    }
}

export class RestaurantStore extends Store {
    Model = Restaurant;
}

export class Location extends Model {
    @observable id = null;
    @observable name = '';

    relations() {
        return {
            restaurants: RestaurantStore,
        };
    }
}

export class Customer extends Model {
    @observable id = null;
    @observable name = '';

    relations() {
        return {
            town: Location,
        };
    }
}

export class CustomerStore extends Store {
    Model = Customer;
    api = new BinderApi();
    url = '/api/human/';
}
