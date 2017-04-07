import moment from 'moment';
import { isArray } from 'lodash';

function checkMomentInstance(attr, value) {
    if (!moment.isMoment(value)) {
        throw new Error(`Attribute \`${attr}\` is not a moment instance.`);
    }
}

export default {
    date: {
        parse(attr, value) {
            if (value === null) {
                return null;
            }
            return moment.utc(value, 'YYYY-MM-DD');
        },
        toJS(attr, value) {
            if (value === null) {
                return null;
            }
            checkMomentInstance(attr, value);
            return value.format('YYYY-MM-DD');
        },
    },
    datetime: {
        parse(attr, value) {
            if (value === null) {
                return null;
            }
            return moment.utc(value);
        },
        toJS(attr, value) {
            if (value === null) {
                return null;
            }
            checkMomentInstance(attr, value);
            return value.format();
        },
    },
    enum: expectedValues => {
        if (!isArray(expectedValues)) {
            throw new Error(
                'Invalid argument suplied to `Casts.enum`, expected an instance of array.'
            );
        }
        function checkExpectedValues(attr, value) {
            if (value === null) {
                return null;
            }
            if (expectedValues.includes(value)) {
                return value;
            }
            throw new Error(
                `Value set to attribute \`${attr}\`, ${JSON.stringify(value)}, is not one of the allowed enum: ${JSON.stringify(expectedValues)}`
            );
        }
        return {
            parse: checkExpectedValues,
            toJS: checkExpectedValues,
        };
    },
};
