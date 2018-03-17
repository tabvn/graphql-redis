import Redis from 'ioredis'
import User from "./models/user"
import 'babel-polyfill'
import {database} from "./config";
import Token from "./models/token";
import Role from "./models/role";

export default class Database {

    constructor() {
        this.db = new Redis(database.port, database.host);
        this._models = null;
    }

    /** Register model class
     * List of models
     */
    models() {

        if (!this._models) {
            this._models = {
                user: new User(this),
                token: new Token(this),
                role: new Role(this),
            };
        }
        return this._models;


    }

}