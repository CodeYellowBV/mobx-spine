export function invariant(condition, message = 'Illegal state') {
    if (!condition) {
        throw new Error(`[mobx-spine] ${message}`);
    }
}
