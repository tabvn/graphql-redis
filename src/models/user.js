import Model from "./index";
import {GraphQLString, GraphQLNonNull, GraphQLID} from 'graphql'

export default class User extends Model {
    constructor(database) {
        super(database, 'users');
    }


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