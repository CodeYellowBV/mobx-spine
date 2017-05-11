// lodash's `snakeCase` method removes dots from the string; this breaks mobx-spine
export default function camelToSnake(s) {
    return s.replace(/([A-Z])/g, $1 => '_' + $1.toLowerCase());
}
