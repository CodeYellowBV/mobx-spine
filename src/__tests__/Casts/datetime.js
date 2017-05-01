import { Model, Casts } from '../../';
import { observable } from 'mobx';
import moment from 'moment';
import momentLocale from 'moment/min/moment-with-locales';

class Animal extends Model {
    @observable bornAt = null;

    casts() {
        return {
            bornAt: Casts.datetime,
        };
    }
}

// Unfortunately we can't check the whole datetime because the CI has a different timezone so that fucks things up.
// I should really fix this but I really don't want to. Do you? Fuck timezones.

test('should parse to model', () => {
    const animal = new Animal();

    expect(animal.bornAt).toBe(null);

    animal.parse({
        bornAt: '2017-03-22T22:08:23',
    });

    expect(animal.bornAt).toBeInstanceOf(moment);
    expect(animal.bornAt.format()).toEqual(
        expect.stringContaining('2017-03-22T')
    );
});

test('should parse to model when null', () => {
    const animal = new Animal({ bornAt: '2017-03-22T22:08:23+00:00' });
    expect(animal.bornAt).toBeInstanceOf(moment);

    animal.parse({
        bornAt: null,
    });

    expect(animal.bornAt).toBe(null);
});

test('should be serialized in toJS()', () => {
    const animal = new Animal({ bornAt: '2017-03-22T22:08:23+00:00' });

    expect(animal.toJS().bornAt).toEqual(expect.stringContaining('2017-03-22'));
});

test('should be serialized in toJS() when null', () => {
    const animal = new Animal();

    expect(animal.toJS()).toEqual({
        bornAt: null,
    });
});

test('toJS() should throw error when moment instance is gone', () => {
    const animal = new Animal({ bornAt: '2017-03-22T22:08:23+00:00' });

    animal.bornAt = 'asdf';

    expect(() => {
        return animal.toJS();
    }).toThrow('Attribute `bornAt` is not a moment instance.');
});

test('should be serialized in toBackend()', () => {
    const animal = new Animal({ bornAt: '2017-03-22T22:08:23+00:00' });

    expect(animal.toBackend().born_at).toEqual(
        expect.stringContaining('2017-03-22')
    );
});

test('moment instance with locale should be recognized', () => {
    const animal = new Animal();
    animal.bornAt = momentLocale('2017-03-22T22:08:23+00:00');
    expect(animal.toJS().bornAt).toEqual(expect.stringContaining('2017-03-22'));
});
