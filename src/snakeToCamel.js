// lodash's `camelCase` method removes dots from the string; this breaks mobx-binder
export default function snakeToCamel(s) {
    if (s.startsWith('_')) {
        return s;
    }
    return s.replace(/_\w/g, m => m[1].toUpperCase());
}
