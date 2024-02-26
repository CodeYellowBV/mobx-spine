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

test('GET request with default headers', () => {
    mock.onAny().replyOnce(config => {
        expect(config.headers['X-Foo']).toBe('bar');
        return [200, {}];
    });

    const api = new BinderApi();
    api.defaultHeaders['X-Foo'] = 'bar';
    return api.get('/api/asdf/');
});

test('GET request with custom Content-Type', () => {
    mock.onAny().replyOnce(config => {
        expect(config.headers).toEqual({
            Accept: 'application/json, text/plain, */*',
            'Content-Type': 'multipart/form-data',
            'X-Foo': 'bar',
        });
        return [200, {}];
    });

    const api = new BinderApi();
    // Also add a default header to verify that the header is not overridden
    api.defaultHeaders['X-Foo'] = 'bar';
    return api.get('/api/asdf/', null, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
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

test('POST request to custom endpoint (#78)', () => {
    mock.onPost('/api/foo/asdf/').replyOnce(config => { // No double leading slash
        expect(config.url).toBe('/asdf/');
        expect(config.method).toBe('post');
        expect(config.params).toEqual(undefined);
        return [200, { }];
    });

    const api = new BinderApi();
    api.baseUrl = '/api/foo/';

    return api.post('/asdf/').then(res => {
        expect(res).toEqual({ });
    });
});

test('POST request with data', () => {
    mock.onAny().replyOnce(config => {
        expect(config.params).toEqual(undefined);
        expect(config.data).toEqual(JSON.stringify({ foo: 'bar' }));
        return [200, {}];
    });

    return new BinderApi().post('/api/asdf/', { foo: 'bar' });
});

test('POST request with params', () => {
    mock.onAny().replyOnce(config => {
        expect(config.params).toEqual({ branch: 1 });
        expect(config.data).toEqual(JSON.stringify({ foo: 'bar' }));
        return [200, {}];
    });

    return new BinderApi().post(
        '/api/asdf/',
        { foo: 'bar' },
        { params: { branch: 1 } }
    );
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

test('POST request with failing CSRF', () => {
    mock.onAny().replyOnce(config => {
        return [403, { code: 'CSRFFailure' }];
    });
    mock.onGet('/api/bootstrap/').replyOnce(config => {
        return [200, { csrf_token: 'beasts' }];
    });
    mock.onAny().replyOnce(config => {
        return [200, { foo: true }];
    });
    const api = new BinderApi();
    api.csrfToken = 'ponys';
    return api.post('/api/asdf/', { foo: 'bar' }).then(res => {
        expect(res).toEqual({ foo: true });
        expect(api.csrfToken).toBe('beasts');
    });
});

test('POST request with failing second CSRF', () => {
    mock.onAny().replyOnce(config => {
        return [403, { code: 'CSRFFailure' }];
    });
    mock.onGet('/api/bootstrap/').replyOnce(config => {
        return [200, { csrf_token: 'beasts' }];
    });
    mock.onAny().replyOnce(config => {
        return [403, { code: 'CSRFFailure' }];
    });
    const api = new BinderApi();
    api.csrfToken = 'ponys';
    return api.post('/api/asdf/', { foo: 'bar' }).catch(err => {
        expect(err.response.status).toBe(403);
    });
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

    return api
        .delete('/api/asdf/')
        .catch(() => errorHandle())
        .then(() => {
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

    return api
        .delete('/api/asdf/')
        .catch(() => errorHandle())
        .then(() => {
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

test('Blobs in json get converted to form data', () => {
    const foo = new Blob(['foo'], { type: 'text/plain' });
    const bar = new Blob(['bar'], { type: 'text/plain' });

    mock.onAny().replyOnce(config => {
        expect(config.url).toBe('/api/test/');
        expect(config.method).toBe('put');
        expect(config.params).toEqual(undefined);
        expect(config.data).toBeInstanceOf(FormData);

        const keys = Array.from(config.data.keys()).sort();
        expect(keys).toEqual(['data', 'file:bar.2', 'file:foo']);

        const data = JSON.parse(config.data.get('data'));
        expect(data).toEqual({
            foo: null,
            bar: [1, 'test', null],
        });

        const foo = config.data.get('file:foo');
        expect(foo).toBeInstanceOf(Blob);

        const bar = config.data.get('file:bar.2');
        expect(bar).toBeInstanceOf(Blob);

        return [200, {}];
    });

    const api = new BinderApi();
    return api.put('/api/test/', {
        foo,
        bar: [1, 'test', bar],
    });
});

test('FormData is left intact', () => {
    const foo = new Blob(['foo'], { type: 'text/plain' });
    const bar = new Blob(['bar'], { type: 'text/plain' });
    const data = new FormData();
    data.set('foo', foo);
    data.set('bar', bar);

    mock.onAny().replyOnce(config => {
        expect(config.url).toBe('/api/test/');
        expect(config.method).toBe('put');
        expect(config.params).toEqual(undefined);
        expect(config.data).toBeInstanceOf(FormData);

        const keys = Array.from(config.data.keys()).sort();
        expect(keys).toEqual(['bar', 'foo']);

        const foo = config.data.get('foo');
        expect(foo).toBeInstanceOf(Blob);

        const bar = config.data.get('bar');
        expect(bar).toBeInstanceOf(Blob);

        return [200, {}];
    });

    const api = new BinderApi();
    return api.put('/api/test/', data);
});

test('Blob is left intact', () => {
    const data = new Blob(['foo'], { type: 'text/plain' });

    mock.onAny().replyOnce(config => {
        expect(config.url).toBe('/api/test/');
        expect(config.method).toBe('put');
        expect(config.params).toEqual(undefined);
        expect(config.data).toBeInstanceOf(Blob);

        return [200, {}];
    });

    const api = new BinderApi();
    return api.put('/api/test/', data);
});
