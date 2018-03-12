import "babel-polyfill"
import ObjectID from '../lib/objectid'
import {database} from "../config";
import moment from 'moment'
import _ from 'lodash'

export default class Model {

    constructor(database, name) {
        this.name = name;
        this.database = database;
    }

    /**
     * Return Redis for query
     * @returns {*|number|Redis|IDBDatabase}
     */
    getDataSource() {
        return this.database.db;
    }

    /**
     * Generate id
     * @returns {*}
     */
    autoId() {
        return new ObjectID().toString();
    }

    /**
     * Collection Prefix
     * @returns {string}
     */
    prefix() {
        return `${database.name}:${this.name}`;
    }

    /**
     * Validate email address
     * @param email
     * @returns {boolean}
     */
    isEmail(email = "") {

        const regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        return regex.test(email);
    }


    /**
     * Create or Update a document to collection
     * @param id
     * @param model
     * @returns {Promise<any>}
     */
    async save(id = null, model) {

        let isValid = false;
        let validateError = null;

        try {
            isValid = await this.validate(id, model);
        } catch (err) {
            validateError = err;
        }

        console.log("Is valid", isValid, validateError);

        const db = this.getDataSource();
        id = id ? id : this.autoId();
        model.id = id;

        return new Promise((resolve, reject) => {


            db.hmset(`${this.prefix()}:values:${id}`, model, (err) => {
                // after create we do need add members to array
                db.zadd(`${this.prefix()}:keys`, moment().unix(), id);
                return err ? reject(err) : resolve(model);
            });
        });
    }

    /**
     * Validate the Document before save to collection
     * @param id
     * @param model
     * @returns {Promise<any>}
     */
    validate(id = null, model) {


        return new Promise((resolve, reject) => {

            const fields = this.fields();
            let data = {};
            let error = [];
            _.each(fields, (fieldSettings, fieldName) => {
                const isAutoId = _.get(fieldSettings, 'autoId', false);
                const defaultValue = _.get(fieldSettings, 'defaultValue');
                const fieldValue = _.get(model, fieldName, defaultValue);
                const isEmailField = _.get(fieldSettings, 'email', false);
                const isRequired = _.get(fieldSettings, 'required', false);

                data = _.setWith(data, fieldName, fieldValue); // set field and value
                if (isRequired && typeof fieldValue !== 'boolean' && !_.get(model, fieldName)) {
                    error.push(`${fieldName} is required`);
                }
                // if field is autoId, and is new then we remove id field.
                if (!id && isAutoId) {
                    _.unset(data, fieldName);
                }
                if (isEmailField && fieldValue && !this.isEmail(fieldValue)) {
                    error.push(`${fieldName} must email valid`);
                }
                console.log(fieldSettings, fieldName);
            });
            return error.length ? reject(error) : resolve(data);

        });
    }

    /**
     * Get document by Id
     * @param id
     * @returns {Promise<any>}
     */
    get(id) {

        const db = this.getDataSource();
        return new Promise((resolve, reject) => {
            db.hgetall(`${this.prefix()}:values:${id}`, (err, result) => {
                return err ? reject(err) : resolve(result);
            })
        });
    }

    /**
     * List documents in collection
     * @param filter
     * @returns {Promise<any>}
     */
    find(filter = null) {

        const db = this.getDataSource();
        const limit = _.get(filter, 'limit', 50);
        const skip = _.get(filter, 'skip', 0);

        return new Promise((resolve, reject) => {
            const max = '+inf';
            const min = '-inf';
            const args = [`${this.prefix()}:keys`, max, min, 'LIMIT', skip, limit];

            db.zrevrangebyscore(args, (err, result) => {
                if (err) {
                    return reject(err);
                }

                if (result && result.length) {

                    let pipline = db.pipeline();
                    let models = [];

                    _.each((result), (key) => {
                        pipline.hgetall(`${this.prefix()}:values:${key}`);
                    });

                    pipline.exec((err, results) => {
                        if (err) {
                            return reject(err);
                        }

                        _.each(results, (v) => {
                            const error = _.get(v, '[0]');
                            if (error === null) {
                                models.push(_.get(v, '[1]'));
                            }
                        });
                        return resolve(models);
                    });

                } else {
                    return resolve([]);
                }

            });
        })
    }

    /**
     * Count document in collection
     * @returns {Promise<any>}
     */
    count() {

        const db = this.getDataSource();
        return new Promise((resolve, reject) => {
            const args = [`${this.prefix()}:keys`, '-inf', '+inf'];
            db.zcount(args, (err, result) => {
                return err ? reject(err) : resolve(result ? result : 0);
            });
        })
    }

    /**
     * Delete document from collection by Id
     * @param id
     * @returns {Promise<any>}
     */
    delete(id) {

        return new Promise((resolve, reject) => {

            const db = this.getDataSource();
            const prefix = this.prefix();

            // we also remove members from zadd
            const args = [`${prefix}:keys`, id];
            db.zrem(args, (err, result) => {
                console.log("remove key with ", err, result);
            });

            db.del(`${prefix}:values:${id}`, (err, result) => {
                console.log("Remove document", id, err, result);
            })
        })
    }

    /**
     * Field schema
     * @returns {{id: {primary: boolean, index: boolean, autoId: boolean}}}
     */
    fields() {

        return {
            id: {
                primary: true,
                index: true,
                autoId: true
            }
        }
    }

}