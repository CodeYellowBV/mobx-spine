# mobx-spine

[![Build Status](https://travis-ci.org/CodeYellowBV/mobx-spine.svg?branch=master)](https://travis-ci.org/CodeYellowBV/mobx-spine)
[![codecov](https://codecov.io/gh/CodeYellowBV/mobx-spine/branch/master/graph/badge.svg)](https://codecov.io/gh/CodeYellowBV/mobx-spine)

A frontend package built upon [MobX](https://mobx.js.org/) to add models and collections. It has first-class support for relations and can communicate to a backend.

By default it comes with a "communication layer" for [Django Binder](https://github.com/CodeYellowBV/django-binder), which is Code Yellow's Python backend framework. It is easy to add support for another backend.

```shell
yarn add mobx-spine lodash mobx moment
npm install mobx-spine lodash mobx moment
```

**Work In Progress.**

mobx-spine is highly inspired by Backbone and by the package we built on top of Backbone, [Backbone Relation](https://github.com/CodeYellowBV/backbone-relation).

## Design differences with Backbone

Since mobx-spine uses MobX, it does not need to have an event system like Backbone has. This means that there are no `this.listenTo()`'s. If you need something like that, look for [`autorun()`](https://mobx.js.org/refguide/autorun.html) or add a [`@computed`](https://mobx.js.org/refguide/computed-decorator.html) property.

Another difference is that in mobx-spine, all properties of a model must be defined beforehand. So if a model has the props `id` and `name` defined, it's not possible to suddenly add a `slug` property unless you define it on the model itself. Not allowing this helps with keeping overview of the props there are.

mobx-spine has support for relations and pagination built-in, in contrast to Backbone.

A model or collection can only do requests to an API if you add an `api` instance to it. This allows for easy mocking of the API, and makes mobx-spine not coupled to Binder, our Python framework. It would be easy to make a package or just a separate file with a custom backend.

## Usage

A basic example of mobx-spine:

```js
import { observable } from 'mobx';
import { Model, Store, BinderApi } from 'mobx-spine';

class Animal extends Model {
    @observable id = null;
    @observable name = '';
}

const animal = new Animal();
animal.name = 'Lion';
animal.color = 'green' // `color` is not defined, so this does not trigger a re-render if used in a component.
```

An example with relations:

```js
const api = new BinderApi();

class Breed extends Model {
    @observable id = null;
    @observable name = '';
}

class Animal extends Model {
    api = api;
    urlRoot = '/api/animal/';
    @observable id = null;
    @observable name = '';

    relations() {
        return {
            breed: Breed,
        };
    }
}

class animal = new Animal({ id: 2 }, { relations: ['breed'] });
animal.fetch(); // Performs a request: GET api/animal/2?with=breed
console.log(animal.breed.name);
```

An example with a Store (called a Collection in Backbone):

```js
class AnimalStore extends Store {
    api = api;
    url = '/api/animal/';
    Model = Animal;
}

class animalStore = new AnimalStore(null, { relations: ['breed'] });
animalStore.fetch(); // Performs a request: GET api/animal/?with=breed
```

An example of saving data:

```js
class Animal extends Model {
    api = api;
    urlRoot = '/api/animal/';
    @observable id = null;
    @observable name = '';
    @observable _errors = {};
}

const animal = new Animal({ id: 1, name: 'King' });
animal.save(); // Performs a request: POST api/animal
// Note that the `_errors` prop will not be included in the request;
// props starting with an underscore are frontend-only.
```


## Pick fields

You can pick fields by either defining a static pickFields or as a function. Keep in mind that `id` is mandatory, so it will always be included.

### As a static field
```js
class Animal extends Model {
    static pickFields = ['name'];

    @observable id = null;
    @observable name = '';
    @observable color = '';
}

const animal = new Animal({ id: 1, name: 'King', color: 'orange' });
animal.toBackend(); // { id: 1, name: 'King' }
```

### As a function
```js
class Animal extends Model {
    pickFields() {
        return ['name];
    }

    @observable id = null;
    @observable name = '';
    @observable color = '';
}

const animal = new Animal({ id: 1, name: 'King', color: 'orange' });
animal.toBackend(); // { id: 1, name: 'King' }
```

## Omit fields

You can omit fields by either defining a static pickFields or as a function. Keep in mind that `id` is mandatory, so it will always be included.

### As a static field
```js
class Animal extends Model {
    static omitFields = ['color'];

    @observable id = null;
    @observable name = '';
    @observable color = '';
}

const animal = new Animal({ id: 1, name: 'King', color: 'orange' });
animal.toBackend(); // { id: 1, name: 'King' }
```

### As a function
```js
class Animal extends Model {
    pickFields() {
        return ['color];
    }

    @observable id = null;
    @observable name = '';
    @observable color = '';
}

const animal = new Animal({ id: 1, name: 'King', color: 'orange' });
animal.toBackend(); // { id: 1, name: 'King' }
```
