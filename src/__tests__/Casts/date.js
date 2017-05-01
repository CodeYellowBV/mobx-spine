import { Model, Casts } from '../../';
import { observable } from 'mobx';
import moment from 'moment';

class Animal extends Model {
    @observable birthDate = null;

    casts() {
        return {
            birthDate: Casts.date,
        };
    }
}

test('should parse to model', () => {
    const animal = new Animal();

    expect(animal.birthDate).toBe(null);

    animal.parse({
        birthDate: '1995-03-22',
    });

    expect(animal.birthDate).toBeInstanceOf(moment);
    expect(animal.birthDate.format('YYYY-MM-DD')).toBe('1995-03-22');
});

test('should parse to model when null', () => {
    const animal = new Animal({ birthDate: '1995-03-22' });
    expect(animal.birthDate).toBeInstanceOf(moment);

    animal.parse({
        birthDate: null,
    });

    expect(animal.birthDate).toBe(null);
});

test('parse() should throw away time info', () => {
    const animal = new Animal({ birthDate: '2017-03-22T22:08:23+00:00' });

    expect(animal.birthDate.format('YYYY-MM-DD')).toBe('2017-03-22');
});

test('should be serialized in toJS()', () => {
    const animal = new Animal({ birthDate: '1995-03-22' });

    expect(animal.toJS()).toEqual({
        birthDate: '1995-03-22',
    });
});

test('should be serialized in toJS()', () => {
    const animal = new Animal();

    expect(animal.toJS()).toEqual({
        birthDate: null,
    });
});

test('toJS() should throw error when moment instance is gone', () => {
    const animal = new Animal({ birthDate: '1995-03-22' });

    animal.birthDate = 'asdf';

    expect(() => {
        return animal.toJS();
    }).toThrow('Attribute `birthDate` is not a moment instance.');
});
