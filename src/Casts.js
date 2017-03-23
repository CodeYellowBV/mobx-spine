import moment from 'moment';

function checkMomentInstance(attr, value) {
    if (!(value instanceof moment)) {
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
};
