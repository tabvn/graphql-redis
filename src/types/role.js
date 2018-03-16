import {GraphQLScalarType} from 'graphql'
import {GraphQLError} from 'graphql/error'
import {Kind} from 'graphql/language'
import _ from 'lodash'

export const SEP = '|';

const strToArray = (str) => {

    let v = [];
    const arr = _.split(str, SEP);

    _.each(arr, (ar) => {
        v.push(_.toLower(_.trim(ar)));
    });

    v = _.uniq(v);

    return v;
};


export default new GraphQLScalarType({
    name: 'Role',
    description: 'User roles',

    serialize(value) {

        if (typeof value !== 'string') {
            throw new TypeError(`Value is not string: ${value}`);
        }
        return strToArray(value);
    },

    parseValue(value) {
        if (typeof value !== 'string') {
            throw new TypeError('Value is not string');
        }
        return strToArray(value);
    },

    parseLiteral(ast) {

        const kind = ast.kind;
        const values = ast.values;

        if (kind !== Kind.LIST) {
            throw new GraphQLError(`Can only validate array of string as roles but got a: ${ast.kind}`);
        }
        let items = [];
        _.each(values, (v) => {
            if (!v.value || v.kind !== Kind.STRING) {
                throw new GraphQLError('User roles only allow array of string');
            }
            else {
                items.push(_.trim(v.value));
            }
        });

        return _.join(items, SEP);
    },
});