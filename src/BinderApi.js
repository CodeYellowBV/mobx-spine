import { mapKeys, mapValues, get } from 'lodash';
import axios from 'axios';
import snakeToCamel from './snakeToCamel';

// Function ripped from Django docs.
// See: https://docs.djangoproject.com/en/dev/ref/csrf/#ajax
function csrfSafeMethod(method) {
    // These HTTP methods do not require CSRF protection.
    return (/^(GET|HEAD|OPTIONS|TRACE)$/i.test(method));
}

function parseBackendValidationErrors(response) {
    const valErrors = get(response, 'data.error.validation_errors');
    if (response.status === 400 && valErrors) {
        const camelCasedErrors = mapKeys(valErrors, (value, key) => snakeToCamel(key));
        return mapValues(camelCasedErrors, (valError) => {
            return valError.map(obj => obj.code);
        });
    }
    return null;
}

export default class BinderApi {
    baseUrl = null;
    csrfToken = null;
    defaultHeaders = {};

    __request(method, url, data, options) {
        options || (options = {});
        const useCsrfToken = csrfSafeMethod(method) ? undefined : this.csrfToken;

        const axiosOptions = {
            method,
            baseURL: this.baseUrl,
            url,
            data: method !== 'get' && data ? data : undefined,
            params: method === 'get' && data ? data : undefined,
            headers: Object.assign({
                'Content-Type': 'application/json',
                'X-Csrftoken': useCsrfToken,
            }, this.defaultHeaders),
        };

        Object.assign(axiosOptions, options);

        return axios(axiosOptions)
        .then(response => response.data);
    }

    get(url, data, options) {
        return this.__request('get', url, data, options);
    }

    post(url, data, options) {
        return this.__request('post', url, data, options);
    }

    patch(url, data, options) {
        return this.__request('patch', url, data, options);
    }

    put(url, data, options) {
        return this.__request('put', url, data, options);
    }

    delete(url, data, options) {
        return this.__request('delete', url, data, options);
    }

    fetchModel({ url, data }) {
        return this.get(url, data)
        .then((res) => {
            return {
                data: res.data,
                repos: res.with,
                relMapping: res.with_mapping,
            };
        });
    }

    saveModel({ url, data, isNew }) {
        const method = isNew ? 'patch' : 'post';
        return this[method](url, data)
        .catch((err) => {
            if (err.response) {
                err.valErrors = parseBackendValidationErrors(err.response);
            }
            throw err;
        });
    }

    deleteModel({ url }) {
        // TODO: kind of silly now, but we'll probably want better error handling soon.
        return this.delete(url);
    }

    fetchStore({ url, data }) {
        return this.get(url, data)
        .then((res) => {
            return {
                data: res.data,
                repos: res.with,
                relMapping: res.with_mapping,
                totalRecords: res.meta.total_records,
            };
        });
    }
}
