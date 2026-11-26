import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// axios >= 0.32 merges the request headers into an Object.create(null) object,
// which axios-mock-adapter (up to at least 2.1.0) can't handle: it reads
// `config.headers.constructor.name` and throws. See
// https://github.com/ctimmerm/axios-mock-adapter/issues/415. Until that is
// fixed, hand the mock a plain copy of the headers. `mock.restore()` still puts
// the original adapter back.
export default function mockAxios() {
    const mock = new MockAdapter(axios);
    const mockAdapter = axios.defaults.adapter;
    axios.defaults.adapter = config =>
        mockAdapter({ ...config, headers: { ...config.headers } });
    return mock;
}
