import Model from "./index";
import DateTime from '../types/datetime'
import jwt from 'jsonwebtoken'
import {jwtSecret} from "../config";
import {
    GraphQLID,
    GraphQLNonNull,
    GraphQLString,
} from 'graphql';

export default class Token extends Model {
    constructor(database) {
        super(database, 'tokens', 'token');
    }


    /**
     * JWT sign
     * @param data
     * @returns {*}
     */
    jwtSign(data) {
        return jwt.sign(data, jwtSecret);

    }

    /**
     * Verify token
     * @param token
     * @returns {Promise<any>}
     */

    verifyToken(token) {

        const db = this.getDataSource();
        const prefix = this.prefix();

        const args = `${prefix}:unique:token:${token}`;

        return new Promise((resolve, reject) => {

            db.get(args, (err, data) => {

                console.log("Validate token ", err, data);
                if (err || data === null) {
                    return reject('Not found');
                }

                jwt.verify(token, jwtSecret, {ignoreExpiration: true}, (err, decoded) => {
                    return err ? reject(err) : resolve(decoded);
                });

            });

        })
    }

    /**
     * Hook before model is insert
     * @param model
     */

    beforeCreate(model) {

        return new Promise((resolve, reject) => {

            super.beforeCreate(model).then((model) => {
                model.token = this.jwtSign({userId: model.userId});
                return resolve(model);

            }).catch(err => {
                return reject(err);

            });

        })
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
            userId: {
                type: GraphQLNonNull(GraphQLString),
                required: true,
            },
            token: {
                type: GraphQLString,
                unique: true,
            },
            created: {
                type: DateTime,
                defaultValue: new Date(),
            },
        }
    }
}