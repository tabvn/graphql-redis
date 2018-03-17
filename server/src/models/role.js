import Model from "./index";
import DateTime from '../types/datetime'

import {
    GraphQLID,
    GraphQLNonNull,
    GraphQLString,
} from 'graphql';


export default class Role extends Model {
    constructor(database) {
        super(database, 'roles', 'role');
    }

    /**
     * Fields
     */
    fields() {

        return {
            id: {
                primary: true,
                index: true,
                autoId: true,
                type: GraphQLID
            },
            name: {
                type: GraphQLNonNull(GraphQLString),
                required: true,
                unique: true,
                index: true,
                lowercase: true,
            },
            created: {
                type: DateTime,
                defaultValue: new Date().toJSON()
            }
        }
    }
}