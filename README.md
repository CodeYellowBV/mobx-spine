# mobx-binder

[![Build Status](https://travis-ci.org/CodeYellowBV/mobx-binder.svg?branch=master)](https://travis-ci.org/CodeYellowBV/mobx-binder)
[![codecov](https://codecov.io/gh/CodeYellowBV/mobx-binder/branch/master/graph/badge.svg)](https://codecov.io/gh/CodeYellowBV/mobx-binder)

A frontend package built upon [MobX](https://mobx.js.org/) to work with [Django Binder](https://github.com/CodeYellowBV/django-binder).

**Work In Progress.**

mobx-binder is highly inspired by Backbone and by the package we built on top of Backbone, [Backbone Relation](https://github.com/CodeYellowBV/backbone-relation).

## Usage

One major design difference to Backbone is that in mobx-binder, all properties of a model must be defined beforehand.

A basic example of mobx-binder:

```js
import { observable } from 'mobx';
import { Model } from 'mobx-binder';

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
import { Store } from 'mobx-binder';

class AnimalStore extends Store {
    url = '/api/animal/';
    Model = Animal
}

class animalStore = new AnimalStore(null, { relations: ['breed'] });
animalStore.fetch(); // Performs a request: GET api/animal/?with=breed
```
