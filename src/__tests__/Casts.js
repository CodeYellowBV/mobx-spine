import { Model, Casts } from '../';
import { observable } from 'mobx';
import moment from 'moment';

class Animal extends Model {
    @observable bornAt = null;

    casts() {
        return {
            bornAt: Casts.datetime,
        };
    }
}

test('datetime - should parse to model', () => {
    const animal = new Animal();

    expect(animal.bornAt).toBe(null);

    animal.parse({
        bornAt: '2017-03-22T22:08:23+00:00',
    });

    expect(animal.bornAt).toBeInstanceOf(moment);
    expect(animal.bornAt.format()).toBe('2017-03-22T22:08:23Z');
});

test('datetime - should parse to model when null', () => {
    const animal = new Animal({ bornAt: '2017-03-22T22:08:23+00:00' });
    expect(animal.bornAt).toBeInstanceOf(moment);

    animal.parse({
        bornAt: null,
    });

    expect(animal.bornAt).toBe(null);
});

test('datetime - should be serialized in toJS()', () => {
    const animal = new Animal({ bornAt: '2017-03-22T22:08:23+00:00' });

    expect(animal.toJS()).toEqual({
        bornAt: '2017-03-22T22:08:23Z',
    });
});

test('datetime - should be serialized in toJS() when null', () => {
    const animal = new Animal();

    expect(animal.toJS()).toEqual({
        bornAt: null,
    });
});

test('datetime - toJS() should throw error when moment instance is gone', () => {
    const animal = new Animal({ bornAt: '2017-03-22T22:08:23+00:00' });

    animal.bornAt = 'asdf';

    expect(() => {
        return animal.toJS();
    }).toThrow('Attribute `bornAt` is not a moment instance.');
});

test('datetime - should be serialized in toBackend()', () => {
    const animal = new Animal({ bornAt: '2017-03-22T22:08:23+00:00' });

    expect(animal.toBackend()).toEqual({
        born_at: '2017-03-22T22:08:23Z',
    });
});

class Animal2 extends Model {
    @observable birthDate = null;

    casts() {
        return {
            birthDate: Casts.date,
        };
    }
}

test('date - should parse to model', () => {
    const animal = new Animal2();

    expect(animal.birthDate).toBe(null);

    animal.parse({
        birthDate: '1995-03-22',
    });

    expect(animal.birthDate).toBeInstanceOf(moment);
    expect(animal.birthDate.format()).toBe('1995-03-22T00:00:00Z');
});

test('date - should parse to model when null', () => {
    const animal = new Animal2({ birthDate: '1995-03-22' });
    expect(animal.birthDate).toBeInstanceOf(moment);

    animal.parse({
        birthDate: null,
    });

    expect(animal.birthDate).toBe(null);
});

test('date - parse() should throw away time info', () => {
    const animal = new Animal2({ birthDate: '2017-03-22T22:08:23+00:00' });

    expect(animal.birthDate.format()).toBe('2017-03-22T00:00:00Z');
});

test('date - should be serialized in toJS()', () => {
    const animal = new Animal2({ birthDate: '1995-03-22' });

    expect(animal.toJS()).toEqual({
        birthDate: '1995-03-22',
    });
});

test('date - toJS() should throw error when moment instance is gone', () => {
    const animal = new Animal2({ birthDate: '1995-03-22' });

    animal.birthDate = 'asdf';

    expect(() => {
        return animal.toJS();
    }).toThrow('Attribute `birthDate` is not a moment instance.');
});
