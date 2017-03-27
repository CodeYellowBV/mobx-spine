import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { BinderApi } from '../';

let mock;
beforeEach(() => {
    mock = new MockAdapter(axios);
});
afterEach(() => {
    if (mock) {
        mock.restore();
        mock = null;
    }
});

test('GET request', () => {
    mock.onAny().replyOnce(config => {
        expect(config.url).toBe('/api/asdf/');
        expect(config.method).toBe('get');
        expect(config.params).toEqual(undefined);
        expect(config.data).toEqual(undefined);
        return [200, { id: 2 }];
    });

    return new BinderApi().get('/api/asdf/').then(res => {
        expect(res).toEqual({ id: 2 });
    });
});

test('GET request with params', () => {
    mock.onAny().replyOnce(config => {
        expect(config.params).toEqual({ foo: 'bar' });
        expect(config.data).toEqual(undefined);
        return [200, {}];
    });

    return new BinderApi().get('/api/asdf/', { foo: 'bar' });
});

test('GET request with headers', () => {
    mock.onAny().replyOnce(config => {
        expect(config.headers['X-Foo']).toBe('bar');
        return [200, {}];
    });

    const api = new BinderApi();
    api.defaultHeaders['X-Foo'] = 'bar';
    return api.get('/api/asdf/');
});

test('GET request without trailing slash', () => {
    const api = new BinderApi();
    expect(() => {
        return api.get('/api/asdf');
    }).toThrow(
        'Binder does not accept urls that do not have a trailing slash: /api/asdf'
    );
});

test('GET request skipping formatter', () => {
    mock.onAny().replyOnce(config => {
        return [200, {}];
    });

    const api = new BinderApi();
    return api.get('/api/asdf/', null, { skipFormatter: true }).then(res => {
        expect(res.status).toBe(200);
    });
});

test('POST request', () => {
    mock.onAny().replyOnce(config => {
        expect(config.url).toBe('/api/asdf/');
        expect(config.method).toBe('post');
        expect(config.params).toEqual(undefined);
        return [200, { id: 2 }];
    });

    return new BinderApi().post('/api/asdf/').then(res => {
        expect(res).toEqual({ id: 2 });
    });
});

test('POST request with params', () => {
    mock.onAny().replyOnce(config => {
        expect(config.params).toEqual(undefined);
        expect(config.data).toEqual(JSON.stringify({ foo: 'bar' }));
        return [200, {}];
    });

    return new BinderApi().post('/api/asdf/', { foo: 'bar' });
});

test('POST request with CSRF', () => {
    mock.onAny().replyOnce(config => {
        expect(config.headers['X-Csrftoken']).toBe('ponys');
        return [200, {}];
    });
    const api = new BinderApi();
    api.csrfToken = 'ponys';
    return api.post('/api/asdf/', { foo: 'bar' });
});

test('PUT request', () => {
    mock.onAny().replyOnce(config => {
        expect(config.method).toBe('put');
        return [200, {}];
    });

    return new BinderApi().put('/api/asdf/');
});

test('PATCH request', () => {
    mock.onAny().replyOnce(config => {
        expect(config.method).toBe('patch');
        return [200, {}];
    });

    return new BinderApi().patch('/api/asdf/');
});

test('DELETE request', () => {
    mock.onAny().replyOnce(config => {
        expect(config.method).toBe('delete');
        return [200, {}];
    });

    return new BinderApi().delete('/api/asdf/');
});

test('Failing request without onRequestError', () => {
    const errorHandle = jest.fn();

    mock.onAny().replyOnce(() => {
        return [500, {}];
    });

    const api = new BinderApi();
    api.__responseFormatter = jest.fn();

    return api.delete('/api/asdf/').catch(() => errorHandle()).then(() => {
        expect(api.__responseFormatter).not.toHaveBeenCalled();
        expect(errorHandle).toHaveBeenCalled();
    });
});

test('Failing request with onRequestError', () => {
    const errorHandle = jest.fn();

    mock.onAny().replyOnce(() => {
        return [500, {}];
    });

    const api = new BinderApi();
    api.__responseFormatter = jest.fn();
    api.onRequestError = jest.fn();

    return api.delete('/api/asdf/').catch(() => errorHandle()).then(() => {
        expect(api.onRequestError).toHaveBeenCalled();
        expect(api.__responseFormatter).not.toHaveBeenCalled();
        expect(errorHandle).toHaveBeenCalled();
    });
});

test('Failing request with onRequestError and skipRequestError option', () => {
    const errorHandle = jest.fn();

    mock.onAny().replyOnce(() => {
        return [500, {}];
    });

    const api = new BinderApi();
    api.__responseFormatter = jest.fn();
    api.onRequestError = jest.fn();

    return api
        .delete('/api/asdf/', null, { skipRequestError: true })
        .catch(() => errorHandle())
        .then(() => {
            expect(api.onRequestError).not.toHaveBeenCalled();
        });
});
