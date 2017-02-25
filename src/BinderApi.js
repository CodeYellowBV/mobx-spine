import { mapKeys, mapValues, get } from 'lodash';
import snakeToCamel from './snakeToCamel';
import request from './request';

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
    baseUrl = '';
    csrfToken = null;

    fetchModel({ url, data }) {
        return request.get(url, data)
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
        return request[method](url, data)
        .catch((err) => {
            if (err.response) {
                err.valErrors = parseBackendValidationErrors(err.response);
            }
            throw err;
        });
    }

    deleteModel({ url }) {
        return request.delete(url);
    }

    fetchStore({ url, data }) {
        return request.get(url, data)
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
