/**
 * Takes an object and changes all negative numbers to be a check for a negative number so that you can check if two
 * objects are the same except for the generated negative ids which can be different.
 *
 * @param expected
 */
export function modifyObjectNegativeIdCheck(object){
    Object.keys(object).forEach((key) => {
        if (object[key] < 0){
             // If value
            object[key] = expect.any(Number);
        } else if (Array.isArray(object[key])) {
             // If list
            modifyListNegativeIdCheck(object[key]);
        } else if (typeof object[key] === 'object' && object[key] !== null){
            // If object
            modifyObjectNegativeIdCheck(object[key]);
        }
    })
}

/**
 * Takes a list and changes all negative numbers to be a check for a negative number so that you can check if two
 * lists or the lists inside of an object are the same except for the generated negative ids which can be different.
 * @param expected
 */
function modifyListNegativeIdCheck(expected){
    debugger
    Array.prototype.forEach.call(expected,(item) => {
        if (item < 0){
             // If value
            expected[expected.indexOf(item)] = expect.any(Number);
        } else if (Array.isArray(item)) {
             // If list
            modifyListNegativeIdCheck(item);
        } else if (typeof item === 'object' && item !== null){
            // If object
            modifyObjectNegativeIdCheck(item);
        }
    })
}

/**
 * Checks if 2 objects are the same ignoring negative ids
 * @param object    The first object you want to compare
 * @param toEqual   The second object you want to compare the first object to
 * @param expect    The expect of the test to do the actual comparison
 * @param bool      True if the objects should be the same, false otherwise (default: true)
 */
export function compareObjectsIgnoringNegativeIds(object, toEqual, expect, bool = true){
    const expected = toEqual
    modifyObjectNegativeIdCheck(expected);
    if (bool === true) {
        expect(object).toMatchObject(expected);
    } else {
        expect(object).not.toMatchObject(expected);
    }
}
