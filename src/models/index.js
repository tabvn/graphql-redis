import "babel-polyfill"
import ObjectID from '../lib/objectid'
import {database} from "../config";
import moment from 'moment'
import _ from 'lodash'
import bcrypt from 'bcrypt'

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
        let validateError = null;

        const prefix = this.prefix();

        const fields = this.fields();
        let indexFields = [];
        let uniqueFields = [];


        try {
            model = await this.validate(id, model);
        } catch (err) {
            validateError = err;
        }

        console.log("Is valid", model, validateError);

        const db = this.getDataSource();
        id = id ? id : this.autoId();
        model.id = id;


        _.each(fields, (fieldSetting, fieldName) => {
            const isIndex = _.get(fieldSetting, 'index', false);
            const fieldValue = _.get(model, fieldName);
            const isUnique = _.get(fieldSetting, 'unique', false);
            if (isIndex && fieldValue) {
                // add to index
                indexFields.push({name: fieldName, value: fieldValue});


            }
            if (isUnique && fieldValue) {
                uniqueFields.push({name: fieldName, value: fieldValue});
            }
        });


        const savePipeline = db.pipeline();

        return new Promise((resolve, reject) => {

            if (validateError) {
                return reject(validateError);
            }

            if (indexFields.length || uniqueFields.length) {

                _.each(uniqueFields, (f) => {
                    savePipeline.set(`${prefix}:unique:${f.name}:${f.value}`, id);

                });
                _.each(indexFields, (f) => {
                    savePipeline.zadd(`${prefix}:index`, f.name, f.value);
                })
            }

            // save model
            savePipeline.hmset(`${prefix}:values:${id}`, model);
            // add to collections keys for members list
            savePipeline.zadd(`${prefix}:keys`, moment().unix(), id);

            savePipeline.exec((err) => {
                return err ? reject(err) : resolve(model);
            })
        });
    }

    /**
     * Validate the Document before save to collection
     * @param id
     * @param model
     * @returns {Promise<any>}
     */
    async validate(id = null, model) {

        const db = this.getDataSource();
        const prefix = this.prefix();
        const fields = this.fields();
        let data = {};
        let error = [];
        let passwordFields = [];
        let uniqueFields = [];

        _.each(fields, (fieldSettings, fieldName) => {
            const isAutoId = _.get(fieldSettings, 'autoId', false);
            const defaultValue = _.get(fieldSettings, 'defaultValue');
            let fieldValue = _.get(model, fieldName, defaultValue);
            const isEmailField = _.get(fieldSettings, 'email', false);
            const isRequired = _.get(fieldSettings, 'required', false);
            const isMinLength = _.get(fieldSettings, 'minLength', 0);
            const isLowercase = _.get(fieldSettings, 'lowercase', false);
            const isPassword = _.get(fieldSettings, 'password', false);
            const isUnique = _.get(fieldSettings, 'unique', false);

            if (isLowercase) {
                fieldValue = _.toLower(fieldValue);
            }
            if (id !== null && !isPassword) {
                error.push(`${fieldName} is required.`);
            }
            if (isPassword) {
                passwordFields.push({name: fieldName, value: fieldValue});
            }
            if (isPassword && id === null && (!fieldValue || fieldValue === "" || fieldValue.length < isMinLength)) {
                error.push(`${fieldName} must greater than ${isMinLength} characters.`);
            }
            if (isPassword && fieldValue && fieldValue !== "" && fieldValue.length >= isMinLength) {
                fieldValue = bcrypt.hashSync(fieldValue, 10);
            }
            data = _.setWith(data, fieldName, fieldValue); // set field and value
            if (isRequired && typeof fieldValue !== 'boolean' && !fieldValue) {
                error.push(`${fieldName} is required`);
            }
            // if field is autoId, and is new then we remove id field.
            if (!id && isAutoId) {
                _.unset(data, fieldName);
            }
            if (isEmailField && fieldValue && !this.isEmail(fieldValue)) {
                error.push(`${fieldName} must email valid`);
            }

            if (isUnique) {
                uniqueFields.push({name: fieldName, value: fieldValue});
            }
        });

        if (passwordFields.length && id) {
            const originalModel = await this.get(id);
            _.each(passwordFields, (field) => {
                const originPassword = _.get(originalModel, field.name);
                if (!field.value || field.value === "" || field.value === originPassword || bcrypt.compareSync(field.value, originPassword)) {
                    data[field.name] = originPassword;
                }

            });
        }


        return new Promise((resolve, reject) => {

            if (error.length) {
                return reject(error);
            }
            if (uniqueFields.length) {
                const uniquePipepline = db.pipeline();
                let uniqueError = [];

                _.each(uniqueFields, (f) => {
                    uniquePipepline.get(`${prefix}:unique:${f.name}:${f.value}`);
                });


                uniquePipepline.exec((err, result) => {

                    if (err) {
                        uniqueError.push(err);
                    }

                    _.each(result, (r, index) => {

                        const errItem = _.get(r, '[0]');
                        const isNotUniqueValue = _.get(r, '[1]');

                        if (errItem !== null) {
                            uniqueError.push(errItem);
                        }
                        if (isNotUniqueValue && id !== isNotUniqueValue) {
                            uniqueError.push(`${uniqueFields[index].name} is already exist.`);
                        }
                    });
                    return uniqueError.length ? reject(uniqueError) : resolve(data);
                });
            } else {
                return resolve(data);
            }


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
            const pipline = db.pipeline();

            const args = [`${prefix}:keys`, id];
            pipline.zrem(args);
            pipline.del(`${prefix}:values:${id}`);
            pipline.exec((err) => {
                return err ? reject(err) : resolve(id);
            });

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