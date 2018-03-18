import _ from 'lodash'
import {Map} from 'immutable'


/**
 * Permissions = [
 {
     value: ['administrator'],
     allow: true,
     type: 'role',
 }
 {
     value: ['id1', 'id2'],
     allow: false,
     type: 'user'
 }
 ]
 */




export default class Topic {

    constructor(params, client = null) {


        console.log("New topic has been created", params);


        this.name = _.get(params, 'name');
        this.user = _.get(client, 'user', null);
        this.permissions = _.get(params, 'permissions', []);
        this._subscribers = new Map();

        this.checkAccess = this.checkAccess.bind(this);
        this.subscribe = this.subscribe.bind(this);
        this.unsubscribe = this.subscribe.bind(this);
        this.publish = this.publish.bind(this);


    }

    /**
     * Client subscribe topics
     * @param client
     */
    subscribe(client) {
        this._subscribers = this._subscribers.set(client.id, client);
    }

    /**
     * Client unsubscribe topic
     * @param client
     */
    unsubscribe(client) {

        this._subscribers = this._subscribers.remove(client.id);
    }

    /**
     * Publish message to topic
     * @param message
     */
    publish(message) {
        // Loop and send message to each subscriber
        this._subscribers.forEach((client, id) => {
            client.send({
                action: 'topic_message',
                payload: {
                    name: this.name,
                    data: message
                }
            });
        });
    }

    /**
     * Check user has permission to access the topic
     */
    checkAccess(user) {
        const userId = _.get(user, 'id', null);
        let userRoles = _.get(user, 'roles', []);

        if (user) {
            userRoles.push('authenticated');
        } else {
            userRoles.push('everyone');
        }

        let allowAccess = !this.permissions.length;
        _.each(this.permissions, (perm) => {

            const isAllow = _.get(perm, 'allow', false);
            const value = _.get(perm, 'value', []);

            if (_.get(perm, 'type') === 'role') {

                // let check by single value if has *
                _.each(value, (v) => {
                    if (v === '*') {
                        allowAccess = isAllow;
                    } else {

                        if (_.includes(userRoles, v)) {
                            allowAccess = isAllow;
                        }

                    }

                });


            } else {
                _.each(value, (v) => {
                    if (v === '*') {
                        allowAccess = isAllow;
                    }
                });

                if (_.includes(value, userId)) {
                    allowAccess = isAllow;
                }

            }
        });


        return allowAccess;

    }

}