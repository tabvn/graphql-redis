import Redis from 'ioredis'
import User from "./models/user"
import 'babel-polyfill'
import {database} from "./config";

export default class Database {

    constructor() {
        this.db = new Redis(database.port, database.host);
    }

    models() {
        return {
            user: new User(this)
        }
    }

}