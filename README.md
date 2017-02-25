# mobx-binder

[![Build Status](https://travis-ci.org/CodeYellowBV/mobx-binder.svg?branch=master)](https://travis-ci.org/CodeYellowBV/mobx-binder)
[![codecov](https://codecov.io/gh/CodeYellowBV/mobx-binder/branch/master/graph/badge.svg)](https://codecov.io/gh/CodeYellowBV/mobx-binder)

A frontend package built upon [MobX](https://mobx.js.org/) to work with [Django Binder](https://github.com/CodeYellowBV/django-binder).

**Work In Progress.**

mobx-binder is highly inspired by Backbone and by the package we built on top of Backbone, [Backbone Relation](https://github.com/CodeYellowBV/backbone-relation).

## Design differences with Backbone

Since mobx-binder uses MobX, it does not need to have an event system like Backbone has. This means that there are no `this.listenTo()`'s. If you need something like that, look for [`autorun()`](https://mobx.js.org/refguide/autorun.html) or add a [`@computed`](https://mobx.js.org/refguide/computed-decorator.html) property.

Another difference is that in mobx-binder, all properties of a model must be defined beforehand. So if a model has the props `id` and `name` defined, it's not possible to suddenly add a `slug` property unless you define it on the model itself. Not allowing this helps with keeping overview of the props there are.

mobx-binder has support for relations and pagination built-in, in contrast to Backbone.

## Usage

A basic example of mobx-binder:

```js
import { observable } from 'mobx';
import { Model, Store } from 'mobx-binder';

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
class Breed extends Model {
    @observable id = null;
    @observable name = '';
}

class Animal extends Model {
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
    url = '/api/animal/';
    Model = Animal
}

class animalStore = new AnimalStore(null, { relations: ['breed'] });
animalStore.fetch(); // Performs a request: GET api/animal/?with=breed
```

An example of saving data:

```js
class Animal extends Model {
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
