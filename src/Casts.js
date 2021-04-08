import moment from 'moment';
import { DateTime } from 'luxon';
import { isArray } from 'lodash';
import { invariant } from './utils';

let DATE_LIB = 'moment';
const SUPPORTED_DATE_LIBS = ['moment', 'luxon'];

export function configureDateLib(dateLib) {
    invariant(
        SUPPORTED_DATE_LIBS.includes(dateLib),
        `Unsupported date lib \`${dateLib}\`. ` +
        `(Supported: ${SUPPORTED_DATE_LIBS.map((dateLib) => `\`${dateLib}\``).join(', ')})`,
    );
    DATE_LIB = dateLib;
}

function checkMomentInstance(attr, value) {
    invariant(
        moment.isMoment(value),
        `Attribute \`${attr}\` is not a moment instance.`
    );
}

function checkLuxonDateTime(attr, value) {
    invariant(
        DateTime.isDateTime(value),
        `Attribute \`${attr}\` is not a luxon instance.`
    );
}

const LUXON_DATE_FORMAT = 'yyyy-LL-dd';
const LUXON_DATETIME_FORMAT = "yyyy'-'LL'-'dd'T'HH':'mm':'ssZZ";

const CASTS = {
    momentDate: {
        parse(attr, value) {
            if (value === null || value === undefined) {
                return null;
            }
            return moment(value, 'YYYY-MM-DD');
        },
        toJS(attr, value) {
            if (value === null || value === undefined) {
                return null;
            }
            checkMomentInstance(attr, value);
            return value.format('YYYY-MM-DD');
        },
        dateLib: 'moment',
    },
    momentDatetime: {
        parse(attr, value) {
            if (value === null) {
                return null;
            }
            return moment(value);
        },
        toJS(attr, value) {
            if (value === null) {
                return null;
            }
            checkMomentInstance(attr, value);
            return value.toJSON(); // Use ISO8601 notation, adjusted to UTC
        },
        dateLib: 'moment',
    },
    luxonDate: {
        parse(attr, value) {
            if (value === null || value === undefined) {
                return null;
            }
            return DateTime.fromISO(value);
        },
        toJS(attr, value) {
            if (value === null || value === undefined) {
                return null;
            }
            checkLuxonDateTime(attr, value);
            return value.toFormat(LUXON_DATE_FORMAT);
        },
        dateLib: 'luxon',
    },
    luxonDatetime: {
        parse(attr, value) {
            if (value === null) {
                return null;
            }

            return DateTime.fromISO(value);
        },
        toJS(attr, value) {
            if (value === null) {
                return null;
            }
            checkLuxonDateTime(attr, value);
            return value.toFormat(LUXON_DATETIME_FORMAT);
        },
        dateLib: 'luxon',
    },
    date: {
        parse(...args) {
            return CASTS[`${DATE_LIB}Date`].parse(...args);
        },
        toJS(...args) {
            return CASTS[`${DATE_LIB}Date`].toJS(...args);
        },
        get dateLib() {
            return DATE_LIB;
        },
    },
    datetime: {
        parse(...args) {
            return CASTS[`${DATE_LIB}Datetime`].parse(...args);
        },
        toJS(...args) {
            return CASTS[`${DATE_LIB}Datetime`].toJS(...args);
        },
        get dateLib() {
            return DATE_LIB;
        },
    },
    enum: expectedValues => {
        invariant(
            isArray(expectedValues),
            'Invalid argument suplied to `Casts.enum`, expected an instance of array.'
        );
        function checkExpectedValues(attr, value) {
            if (value === null) {
                return null;
            }
            if (expectedValues.includes(value)) {
                return value;
            }
            invariant(
                false,
                `Value set to attribute \`${attr}\`, ${JSON.stringify(
                    value
                )}, is not one of the allowed enum: ${JSON.stringify(
                    expectedValues
                )}`
            );
        }
        return {
            parse: checkExpectedValues,
            toJS: checkExpectedValues,
        };
    },
};

export default CASTS;
