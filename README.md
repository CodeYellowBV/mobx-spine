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


## Model

A model is a data container with a set of helper functions. Models should extend `Model` from mobx-spine, and the very least define some properties. 

### Constructor: data

The `Model` contructor takes 2 arguments: 
- `data`: An object with default values for a model.
- `options`: An object with options.

```js
import { observable } from 'mobx';
import { Model } from 'mobx-spine';

// Define a class Animal, with 2 observed properties `id` and `name`.
class Animal extends Model {
    @observable id = null; // Default value is null.
    @observable name = ''; // Default value is ''.
}
```

We've defined a class `Animal` with 2 properties `id` and `name`. If we instantiate a new animal without arguments it will create an empty animal using defaults defined on the model:

```js
// Create an empty instance of an Animal.
const lion = new Animal();

console.log(lion.id); // null
console.log(lion.name); // ''
```

You can also supply data when creating a new instance:

```js
// Create an instance of an Animal with existing data.
const cat = new Animal({ id: 1, name: 'Cat' });

console.log(cat.name); // Cat
```

When data is supplied in the constructor, these can be reset by calling `clear`:

```js
const cat = new Animal({ id: 1, name: 'Cat' });

cat.name = '';
console.log(cat.name); // ''

cat.clear();
console.log(cat.name); // 'Cat'
```

When an undefined property key is supplied, it will be ignored:

```js
const cat = new Animal({ id: 1, name: 'Cat', undefinedProperty: 'will be ignored' });

cat.name = '';
console.log(cat.undefinedProperty); // undefined
```

### Constructor: options

|key|default|  | |
|-|-|-|-|-|-|
|relations|undefined|Relations to be instantiated when instantiating this model as well. Should be an array of strings.| `['location', 'owner.parents']`


### Properties

In its basic form, a model holds a few properties. These properties are normally observables and default values are defined on the property as well. This will define a basic animal model:

```js
import { observable } from 'mobx';
import { Model } from 'mobx-spine';

// Define a class Animal, with 2 observed properties `id` and `name`.
class Animal extends Model {
    @observable id = null; // Default value is null.
    @observable name = ''; // Default value is ''.
    @observable color; // Default value is undefined.
}
```

You can also define frontend only fields, which will be excluded when performing for example a `save`. These properties start with a underscore:

```js
class Animal extends Model {
    @observable id = null;
    @observable name = '';

    /**
     * Fields starts with underscore, so excluded from saving to 
     * backend because `toBackend` filters them out.
     **/ 
    @observable _notSavedToBackend = true;
}
```

#### Forbidden properties

There are some forbidden property names. Currently these are:

- url
- urlRoot
- api
- isNew
- isLoading
- parse
- save
- clear

### Backend request

A model can communicate with the backend using a few functions:

- fetch
- save
- delete

These functions go through the api, and by default the BinderApi is shipped with mobx-spine.

#### Backend request: fetch

Fetching data can be done by calling `fetch`. Lets look at an example and assume the backend returns with `name` `Garfield`:

```js
const api = new BinderApi();

class Animal extends Model {
    api = api;
    
    // Supply either a backendResourceName (Model will calculate urlRoot) or a urlRoot.
    static backendResourceName = 'animal';
    // urlRoot = '/api/animal/';

    @observable id = null;
    @observable name = '';
}

const animal = new Animal({ id: 2 });

// Performs a GET request: /api/animal/2/
animal.fetch().then(() => {
    console.log(animal.name); // Garfield
});


```

#### Backend request: save

Saving data can be done by calling `save`. Lets look at creating a new model and saving that in the database:

```js
const api = new BinderApi();

class Animal extends Model {
    api = api;
    static backendResourceName = 'animal';

    @observable id = null;
    @observable name = '';
}

class animal = new Animal();

// Performs a POST request: /api/animal/
animal.save().then(() => {
    console.log(animal.id); // 1
});
```

An existing model in the database can be updated as follows:

```js
class animal = new Animal({ id: 1 });

// Performs a PUT request: /api/animal/
animal.save().then(() => {
    console.log(animal.id); // 1
});
```

The `save` function accepts a few paramaters as an `options` object:

|key|default|  | |
|-|-|-|-|-|-|
|onlyChanges|false|When true, only changes made with `setInput` are saved.| `animal.save({ onlyChanges: true })`
|url|undefined|When set, use specified url for the request.| `animal.save({ url: '/api/animal/special/url' })`
|data|undefined|When set, append `data` to result. Existing keys from `toBackend` will be overwritten by data, while new keys will be added. | `animal.save({ data: { id: 1, some_other_field: 'will be added' } })`
|mapData|undefined|You can change the data which will be used for the request send by supplying a function. First argument is the formatted data ready for sending a request. Called at the very last of data formatting operations.| `animal.save({ mapData: data => (...data, some_other_field: 'will be added' } ) } })`
|forceFields|undefined|When `onlyChanges` is given, you can force fields to be included despite of having no changes.| `animal.save({ onlyChanges: true, forceFields: ['name'] } ) } })`
|relations|undefined|Relations to be instantiated when instantiating this model as well. Should be an array of strings.| `animal = new Animal({ relations: ['location', 'owner.parents'] })`

#### Backend request: delete

Deleting a model can be done by calling `model.delete()`. Lets look at an example:

```js
const api = new BinderApi();

class Animal extends Model {
    api = api;
    static backendResourceName = 'animal';

    @observable id = null;
    @observable name = '';
}

class animal = new Animal({ id: 2 });

// Performs a DELETE request: /api/animal/2/
animal.delete();


An example with a Store (called a Collection in Backbone).
```

### Relations

Models can have relations to other models / stores. These relations are defined as follows:

```js
class Breed extends Model {
    @observable id = null;
    @observable name = '';
}

class AnimalStore extends Store {
    Model = Animal;
}

class Animal extends Model {
    @observable id = null;
    @observable name = '';

    relations() {
        return {
            breed: Breed, // Define a breed relation to Breed.
            relatives: AnimalStore, // Define a relatives relation to AnimalStore.
        };
    }
}
```

You can now instantiate the animal with it's breed & relatives relation recursively:

```js
class animal = new Animal(
    { 
        id: 2, 
        name: 'Rova', 
        breed: { id: 3, name: 'Main Coon' }, 
        relatives: [
            { id: 5, name: 'Gizmo', breed: { id: 3, name: 'Main Coon' } },
            { id: 7, name: 'Chiggy', breed: { id: 5, name: 'Mixed' } },
        ],
    }, { 
        relations: ['breed', 'relatives.breed'] 
    }
);

console.log(animal.name); // Rova
console.log(animal.breed.name); // Main Coon
console.log(animal.relatives.get(5).name); // Gizmo
console.log(animal.relatives.get(5).breed.name); // Main Coon
console.log(animal.relatives.get(7).name); // Chiggy
console.log(animal.relatives.get(7).breed.name); // Mixed
```

You can now instantiate the animal without it's breed relation and try to access it, it will throw an error:

```js
class animal = new Animal({ id: 2, name: 'Rova', breed: { id: 3, name: 'Main Coon' } });

console.log(animal.breed.name); // Throws cannot read property name from undefined.
```

### Pick fields

You can pick fields by either defining a static `pickFields` variable or a `pickFields` function. Keep in mind that `id` is mandatory, so it will always be included.

#### As a static field
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

#### As a function
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

### Omit fields

You can omit fields by either defining a static `omitFields` variable or a `omitFields` function. Keep in mind that `id` is mandatory, so it will always be included.

#### As a static field
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

#### As a function
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

### Update properties

There are 2 ways to update properties:

- Direct assignment
- Using `setInput`

```js
lion.name = 'Lion'; // Direct assignment, doesn't register a change on the `name` property.
lion.setInput('name',  'Lion'); // Use `setInput` which registers a change on the `name` property.
```

When using `setInput`, a `model.save({ onlyChanges: true })` will only submit fields to the backend which have been changed using `setInput`.

## Store

A Store (Collection in Backbone) is holds multiple instances of models and have several helper functions.

### Constructor: options

|key|default|  | |
|-|-|-|-|-|-|
|relations|undefined|Relations to be instantiated when new models are instantiated using `add()`. Should be an array of strings.| `animalStore = new AnimalStore({ relations: ['location', 'owner.parents'] })`
|limit|25|Page size per fetch, also able to set using `setLimit()`. By default a limit is always set, but there are occations where you want to fetch everything. In this case, set limit to false. | `animalStore = new AnimalStore({ limit: false })`
|comparator|undefined| The models in the store will be sorted by comparator. When it's a string, the models will be sorted by that property name. If it's a function, the models will be sorted using the [default array sort](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort). | `animalStore = new AnimalStore({ comparator: 'name' })`
|params|undefined| All params will be converted to GET params. This is used for quering the server to fill the store with models. | `animalStore = new AnimalStore({ params: { 'search': 'Gizmo' } })`

### Adding models

Adding models to a store can be done using `store.add()`. You can supply either an object or an array of objects:

```js
import { Model } from 'mobx-spine';

class AnimalStore extends Store {
    Model = Animal;
}

const animalStore = new AnimalStore();

animalStore.add({ id: 1, name: 'Rova' });

console.log(animalStore.length) // 1
console.log(animalStore.at(0).name) // Rova

animalStore.add([
    { id: 2, name: 'Gizmo' },
    { id: 3, name: 'Diva' },
]);

console.log(animalStore.length) // 3
console.log(animalStore.at(0).name) // Rova
console.log(animalStore.at(1).name) // Gizmo
console.log(animalStore.at(2).name) // Diva
```

### Getting models

There are a few ways to get a specific model:

- `get`: Use models id.
- `at`: Use model index.
- `find`: Use callback.
- `store.models`: Get the mobx array that holds the models.

Some examples:

```js
animalStore.add([
    { id: 1, name: 'Rova' },
    { id: 2, name: 'Gizmo' },
    { id: 3, name: 'Diva' },
]);

console.log(animalStore.at(0).name) // Rova
console.log(animalStore.get(1).name) // Rova
console.log(animalStore.find(animal => animal.name === 'Rova').name) // Rova
console.log(animalStore.models.find(animal => animal.name === 'Rova').name) // Rova
```

### Backend request

A store can communicate with the backend using a few functions:

- fetch

These functions go through the api, and by default the BinderApi is shipped with mobx-spine.

### Backend request: fetch

Fetching data can be done by calling `fetch`. Lets look at an example and assume the backend returns 1 model with `name` `Garfield`:

```js
const api = new BinderApi();

class AnimalStore extends Store {
    Model = Animal
    api = api;
    
    // Supply either a backendResourceName (Model will calculate url) or a url.
    static backendResourceName = 'animal';
    // url = '/api/animal/';
}

const animalStore = new AnimalStore();

// Performs a GET request: /api/animal/?limit=25
animalStore.fetch().then(() => {
    console.log(animalStore.at(0).name); // Garfield
});
```
