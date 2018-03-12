import Model from "./index";
import {GraphQLString, GraphQLNonNull, GraphQLID} from 'graphql'

export default class User extends Model {
    constructor(database) {
        super(database, 'users');
    }

    /**
     * Override field schema
     * @returns {{id: {primary: boolean, index: boolean, autoId: boolean, type}, email: {unique: boolean, index: boolean, type, email: boolean, required: boolean}, firstName: {type}, lastName: {type}}}
     */
    fields() {

        return {
            id: {
                primary: true,
                index: true,
                autoId: true,
                type: GraphQLID
            },
            email: {
                unique: true,
                index: true,
                type: GraphQLNonNull(GraphQLString),
                email: true,
                required: true,
                lowercase: true,
            },
            password: {
                password: true,
                type: GraphQLString,
                required: true,
                minLength: 3,
            },
            firstName: {
                type: GraphQLNonNull(GraphQLString)
            },
            lastName: {
                type: GraphQLNonNull(GraphQLString)
            }
        }
    }
}