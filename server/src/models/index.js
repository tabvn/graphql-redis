import "babel-polyfill"
import ObjectID from '../lib/objectid'
import {database} from "../config";
import moment from 'moment'
import _ from 'lodash'
import bcrypt from 'bcrypt'
import {GraphQLObjectType, GraphQLID, GraphQLNonNull, GraphQLList, GraphQLInt} from 'graphql'
import EventEmitter from 'events';

const event = new EventEmitter();

export default class Model {

    constructor(database, collection, modelName) {
        this.collection = collection;
        this.modelName = modelName;
        this.database = database;
        this._schema = null;
        this.event = event;

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
        return `${database.name}:${this.collection}`;
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
     * Before document is insert to collection
     * @param model
     * @returns {Promise<any>}
     */
    beforeCreate(model) {

        return new Promise((resolve, reject) => {
            return resolve(model);
        });
    }

    /**
     * Before document is save
     * @param model
     * @returns {Promise<any>}
     */
    beforeSave(model) {

        return new Promise((resolve, reject) => {
            return resolve(model);
        });
    }

    /**
     * Create or Update a document to collection
     * @param id
     * @param model
     * @returns {Promise<any>}
     */
    async save(id = null, model) {


        const relations = this.relations();

        let isNew = !id;

        let originalModel = null;

        if (id) {
            try {
                originalModel = await this.get(id);
            } catch (err) {
                console.log(err);
            }
        }
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


        const db = this.getDataSource();

        let hookError = null;

        if (!validateError) {
            try {
                model = id ? await this.beforeSave(model) : await this.beforeCreate(model);
            } catch (err) {
                hookError = err;
            }

        }


        _.each(fields, (fieldSetting, fieldName) => {
            const isIndex = _.get(fieldSetting, 'index', false);
            const fieldValue = _.get(model, fieldName);
            const isUnique = _.get(fieldSetting, 'unique', false);
            if (isIndex) {
                // add to index
                indexFields.push({name: fieldName, value: fieldValue});
            }
            if (isUnique) {
                uniqueFields.push({name: fieldName, value: fieldValue});
            }
        });


        const savePipeline = db.pipeline();


        return new Promise((resolve, reject) => {

            if (id && !originalModel) {
                isNew = true;
            }


            if (validateError) {
                return reject(validateError);
            }

            if (hookError !== null) {
                return reject(hookError);
            }
            // invoke two hooks , before create and before save


            id = id ? id : this.autoId();
            model.id = id;
            if (!isNew && !_.get(model, 'updated') && _.get(fields, 'updated')) {
                model.updated = new Date().toJSON();
            }

            if (indexFields.length || uniqueFields.length) {

                _.each(uniqueFields, (f) => {
                    // let remove unique from original
                    if (originalModel) {
                        const originalValue = _.get(originalModel, f.name);
                        savePipeline.del(`${prefix}:unique:${f.name}:${originalValue}`);
                    }
                    if (f.value) {
                        savePipeline.set(`${prefix}:unique:${f.name}:${f.value}`, id);
                    }


                });
                _.each(indexFields, (f) => {

                    if (originalModel) {
                        const originalValue = _.get(originalModel, f.name);
                        savePipeline.zrem([`${prefix}:index`, originalValue]);
                    }
                    if (f.value) {
                        savePipeline.zadd(`${prefix}:index`, f.name, f.value);
                    }

                })
            }

            // save model
            savePipeline.hmset(`${prefix}:values:${id}`, model);
            // add to collections keys for members list
            savePipeline.zadd(`${prefix}:keys`, moment().unix(), id);

            savePipeline.exec((err) => {

                if (!err) {
                    // send event
                    const eventString = isNew ? `${this.modelName}_create` : `${this.modelName}_save`;

                    this.event.emit(isNew ? 'create' : 'save', model);
                    this.event.emit(eventString, model);

                    let relationPipeline = db.pipeline();
                    _.each(relations, (relation) => {

                        if (relation.type === 'belongTo') {
                            const relationPrefix = relation.model.prefix();
                            const targetFieldValue = _.get(model, relation.localField);

                            if (originalModel) {
                                const originalTargetValue = _.get(originalModel, relation.localField);
                                // remove from relations
                                relationPipeline.zrem([`${relationPrefix}:relations:${this.collection}:${originalTargetValue}`, id]);
                            }
                            if (targetFieldValue) {
                                // add to relations
                                relationPipeline.zadd(`${relationPrefix}:relations:${this.collection}:${targetFieldValue}`, moment().unix(), id);
                            }

                        }
                    });

                    // execute relations
                    relationPipeline.exec((err) => {

                    });
                }


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

            if (!isPassword && !id && isRequired && typeof fieldValue !== 'boolean' && !fieldValue) {
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
                return err ? reject(err) : resolve(_.get(result, 'id') ? result : null);
            })
        });
    }


    /**
     * Find relation
     * @param id
     * @param relation
     * @param filter
     * @returns {Promise<any>}
     */
    findRelation(id, relation, filter) {
        const db = this.getDataSource();
        const limit = _.get(filter, 'limit', 50);
        const skip = _.get(filter, 'skip', 0);


        return new Promise((resolve, reject) => {
            const max = '+inf';
            const min = '-inf';
            const args = [`${this.prefix()}:relations:${relation.model.collection}:${id}`, max, min, 'LIMIT', skip, limit];

            db.zrevrangebyscore(args, (err, result) => {
                if (err) {
                    return reject(err);
                }

                if (result && result.length) {

                    let pipline = db.pipeline();
                    let models = [];

                    _.each((result), (key) => {
                        pipline.hgetall(`${relation.model.prefix()}:values:${key}`);
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
     * List documents in collection
     * @param filter
     * @returns {Promise<any>}
     */
    find(filter = null) {

        const db = this.getDataSource();
        const limit = _.get(filter, 'limit', null);
        const skip = _.get(filter, 'skip', 0);

        return new Promise((resolve, reject) => {
            const max = '+inf';
            const min = '-inf';
            let args = limit ? [`${this.prefix()}:keys`, max, min, 'LIMIT', skip, limit] : [`${this.prefix()}:keys`, max, min];
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

    beforeDelete(model) {

        return new Promise((resolve, reject) => {
            return resolve(model);
        })
    }

    /**
     * Delete document from collection by Id
     * @param id
     * @returns {Promise<any>}
     */
    async delete(id) {

        const relations = this.relations();

        const fields = this.fields();
        let model = null;

        try {
            model = await this.get(id);
            if (model) {
                await this.beforeDelete(model);
            }

        } catch (err) {
            console.log(err);
        }

        let indexFields = [];
        let uniqueFields = [];

        _.each(fields, (fieldSetting, fieldName) => {
            const isIndex = _.get(fieldSetting, 'index', false);
            const isUnique = _.get(fieldSetting, 'unique', false);
            const fieldValue = _.get(model, fieldName);
            if (isIndex && fieldValue) {
                // add to index
                indexFields.push({name: fieldName, value: fieldValue});
            }
            if (isUnique && fieldValue) {
                uniqueFields.push({name: fieldName, value: fieldValue});
            }
        });


        return new Promise((resolve, reject) => {

            if (!model) {
                return reject("Not found");
            }

            const db = this.getDataSource();
            const prefix = this.prefix();

            // we also remove members from zadd
            const pipline = db.pipeline();

            _.each(indexFields, (f) => {
                pipline.zrem([`${prefix}:index:`, f.value]);
            });

            _.each(uniqueFields, (f) => {
                pipline.del(`${prefix}:unique:${f.name}:${f.value}`);
            });

            pipline.zrem([`${prefix}:keys`, id]);
            pipline.del(`${prefix}:values:${id}`);

            // check relations and also remove relations as well.

            let relationPipeline = db.pipeline();

            _.each(relations, (relation) => {

                switch (relation.type) {
                    case 'belongTo':

                        const relationPrefix = relation.model.prefix();
                        const targetFieldValue = _.get(model, relation.localField);
                        pipline.zrem([`${relationPrefix}:relations:${this.collection}:${targetFieldValue}`, id]);

                        break;

                    case 'hasMany':

                        if (relation.delete) {
                            pipline.del(`${this.prefix()}:relations:${relation.model.collection}:${id}`);

                        }


                        break;


                    default:

                        break;
                }

            });

            pipline.exec((err) => {

                if (!err) {
                    this.event.emit('delete', model);
                    this.event.emit(`${this.modelName}_delete`, model);
                }
                return err ? reject(err) : resolve(id);
            });

        })
    }

    /**
     * Query for GraphQL
     * Queries
     * @returns {{}}
     */
    query() {

        const name = this.modelName;

        const q = {
            [name]: {
                type: this.schema(),
                args: {
                    id: {
                        type: GraphQLID
                    }
                },
                resolve: async (value, args, request) => {

                    const id = _.get(args, 'id');

                    return new Promise((resolve, reject) => {

                        this.get(id).then((model) => {
                            return resolve(model);
                        }).catch((err) => {
                            return reject(err);
                        })

                    });


                }
            },
            [`${name}s`]: {

                type: new GraphQLList(this.schema()),
                args: {
                    limit: {
                        type: GraphQLInt,
                        defaultValue: 0,
                    },
                    skip: {
                        type: GraphQLInt,
                        defaultValue: 0,
                    },

                },
                resolve: async (value, args, request) => {


                    return new Promise((resolve, reject) => {

                        const filter = {
                            limit: _.get(args, 'limit', 0),
                            skip: _.get(args, 'skip', 0),
                        };

                        this.find(filter).then((results) => {

                            return resolve(results);
                        }).catch((err) => {

                            return reject(err);
                        });

                    });


                }
            },
            [`count_${name}`]: {
                type: new GraphQLObjectType({
                    name: `${this.modelName}_count`,
                    fields: () => ({
                        count: {
                            type: GraphQLInt,
                            defaultValue: 0,
                        }
                    })
                }),
                args: {},
                resolve: async (value, args, request) => {

                    return new Promise((resolve, reject) => {

                        this.count().then((num) => {
                            return resolve({count: num});
                        }).catch((err) => {
                            return reject(err);
                        });

                    });


                }
            }

        };


        let relationsQuery = {};

        _.each(this.relations(), (relation) => {

            if (relation.type === 'hasMany') {
                relationsQuery[`${this.modelName}__${relation.model.collection}`] = {
                    type: new GraphQLList(relation.model.schema()),
                    args: {
                        id: {
                            type: GraphQLNonNull(GraphQLID),
                        },
                        limit: {
                            type: GraphQLInt,
                            defaultValue: 50,
                        },
                        skip: {
                            type: GraphQLInt,
                            defaultValue: 0,
                        },

                    },
                    resolve: async (value, args, request) => {


                        return new Promise((resolve, reject) => {

                            const filter = {
                                limit: _.get(args, 'limit', 50),
                                skip: _.get(args, 'skip', 0),
                            };

                            this.findRelation(_.get(args, 'id'), relation, filter).then((results) => {

                                return resolve(results);
                            }).catch((err) => {

                                return reject(err);
                            });

                        });


                    }
                }
            }

        });


        return Object.assign(q, relationsQuery);
    }


    /**
     * Mutations for GraphQL
     * @returns {{}}
     */
    mutation() {

        let fields = this.fields();
        const name = this.modelName;
        _.unset(fields, 'id');

        return {
            [`create_${name}`]: {
                type: this.schema(),
                args: fields,
                resolve: async (root, args, request) => {

                    return new Promise((resolve, reject) => {
                        this.save(null, args).then((model) => {
                            return resolve(model)
                        }).catch((err) => {
                            return reject(err);
                        })
                    });

                }
            },
            [`update_${name}`]: {

                type: this.schema(),
                args: this.fields(),
                resolve: async (value, args, request) => {

                    const id = _.get(args, 'id');

                    return new Promise((resolve, reject) => {

                        this.save(id, args).then((model) => {
                            return resolve(model);
                        }).catch((err) => {
                            return reject(err);
                        })
                    });

                }
            },

            [`delete_${name}`]: {
                type: GraphQLID,
                args: {
                    id: {
                        type: new GraphQLNonNull(GraphQLID)
                    },
                },
                resolve: async (value, args, request) => {

                    const id = _.get(args, 'id');

                    return new Promise((resolve, reject) => {

                        this.delete(id).then((data) => {
                            return resolve(data);
                        }).catch((err) => {
                            return reject(err);
                        });
                    });


                }
            }

        }
    }

    relations() {
        return {};
    }

    /**
     * Schema
     * @returns {null|GraphQLObjectType}
     */
    schema() {

        if (this._schema) {
            return this._schema;
        }
        this._schema = new GraphQLObjectType({
            name: this.modelName,
            description: `${this.modelName}`,
            fields: () => (this.fields())
        });

        return this._schema;
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
            }
        }
    }

}