import { Model, Casts } from '../../';
import { observable } from 'mobx';

class Animal extends Model {
    @observable status = null;

    casts() {
        return {
            status: Casts.enum(['active', 'overdue']),
        };
    }
}

test('should parse to model', () => {
    const animal = new Animal();

    expect(animal.status).toBe(null);

    animal.parse({
        status: 'active',
    });

    expect(animal.status).toBe('active');
});

test('should parse to model when null', () => {
    const animal = new Animal();

    animal.parse({
        status: null,
    });

    expect(animal.status).toBe(null);
});

test('parse() should throw error when invalid enum is used', () => {
    expect(() => {
        return new Animal({ status: 'foo' });
    }).toThrow(
        'Value set to attribute `status`, "foo", is not one of the allowed enum: ["active","overdue"]'
    );
});

test('should be serialized in toJS()', () => {
    const animal = new Animal({ status: 'active' });

    expect(animal.toJS()).toEqual({
        status: 'active',
    });
});

test('should be serialized in toJS() when null', () => {
    const animal = new Animal({ status: 'active' });

    animal.parse({ status: null });

    expect(animal.toJS()).toEqual({
        status: null,
    });
});

test('toJS() should throw error when invalid enum is used', () => {
    const animal = new Animal();

    animal.status = 'blaat';

    expect(() => {
        return animal.toJS();
    }).toThrow(
        'Value set to attribute `status`, "blaat", is not one of the allowed enum: ["active","overdue"]'
    );
});

class AnimalInvalid extends Model {
    @observable status = null;

    casts() {
        return {
            status: Casts.enum('asdf'),
        };
    }
}

test('should throw error when no array is given', () => {
    expect(() => {
        return new AnimalInvalid({ status: 'asdf' });
    }).toThrow(
        'Invalid argument suplied to `Casts.enum`, expected an instance of array.'
    );
});
