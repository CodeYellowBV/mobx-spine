import moment from 'moment';

export default {
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
            if (!(value instanceof moment)) {
                throw new Error(
                    `Attribute \`${attr}\` is not a moment instance.`
                );
            }
            return value.format();
        },
    },
};
