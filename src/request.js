import axios from 'axios';
import { extend } from 'lodash';

let csrfToken = null;
let defaultHeaders = {};
let baseUrl = '';

// Function ripped from Django docs.
// See: https://docs.djangoproject.com/en/dev/ref/csrf/#ajax
function csrfSafeMethod(method) {
    // These HTTP methods do not require CSRF protection.
    return (/^(GET|HEAD|OPTIONS|TRACE)$/i.test(method));
}

function request(method, url, data, options) {
    options || (options = {});
    const useCsrfToken = csrfSafeMethod(method) ? null : csrfToken;

    const axiosOptions = {
        method,
        baseURL: baseUrl,
        url,
        data: method !== 'get' && data ? data : undefined,
        params: method === 'get' && data ? data : undefined,
        headers: Object.assign({
            'Content-Type': 'application/json',
            'X-Csrftoken': useCsrfToken,
        }, defaultHeaders),
    };

    extend(axiosOptions, options);

    const xhr = axios(axiosOptions)
        .then(response => response.data);

    if (options.notifyException !== false) {
        xhr.catch((err) => {
            const resp = err.response;
            if (resp && resp.status === 403 && resp.data.code === 'NotAuthenticated') {
                // TODO: We should do something here...
            }
        });
    }

    return xhr;
}

export default {
    get: (...args) => request.apply(undefined, ['get', ...args]),
    post: (...args) => request.apply(undefined, ['post', ...args]),
    patch: (...args) => request.apply(undefined, ['patch', ...args]),
    put: (...args) => request.apply(undefined, ['put', ...args]),
    delete: (...args) => request.apply(undefined, ['delete', ...args]),
    setCsrfToken: (token) => {
        csrfToken = token;
    },
    setBaseUrl: (url) => {
        baseUrl = url;
    },
    getBaseUrl: () => baseUrl,
    setHeaders: (headers) => {
        defaultHeaders = headers;
    },
    getHeaders: () => defaultHeaders,
};
