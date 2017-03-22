import { Model, AttrCasts } from '../';
import { observable } from 'mobx';
import moment from 'moment';

class Animal extends Model {
    @observable bornAt = null;

    attrCasts() {
        return {
            bornAt: AttrCasts.datetime,
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
    expect(animal.bornAt.format()).toBe('2017-03-22T23:08:23+01:00');
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
        bornAt: '2017-03-22T23:08:23+01:00',
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
        born_at: '2017-03-22T23:08:23+01:00',
    });
});
