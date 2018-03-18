import get from 'lodash.get'
import Emitter from './emitter'

export class Topic {
    constructor(args, connection) {

        this._connection = connection;
        this.name = get(args, 'name');
        this.permissions = get(args, 'permissions', []);


        this.publish = this.publish.bind(this);
        this.subscribe = this.subscribe.bind(this);
        this.send = this.send.bind(this);

        this._event = new Emitter();
        this._subscribers = [];

    }

    /**
     * Publish a message to topic
     * @param message
     */
    publish(message) {

        const data = {
            action: 'topic_publish',
            payload: {
                name: this.name,
                data: message,
            },
        };

        return this._connection.send(data);
    }

    /**
     * Subscribe to the topic
     * @param cb
     */
    subscribe(cb = () => {
    }) {

        this._subscribers.push(cb);
        this._connection.send({
            action: 'topic_subscribe',
            payload: {
                name: this.name,
            }
        }).then(() => {
            // silent nothing to do , just wait for next data

        }).catch((err) => {
            return cb(err);
        });
    }

    send(data) {

        if (this._subscribers.length) {
            this._subscribers.forEach((func) => {
                func(data);
            });
        }
    }

}

export class TopicManager {

    constructor(connection) {
        this._connection = connection;
        this.topics = {};
    }

    /**
     * Create new Topic
     * @param params
     */
    create(params) {

        const topic = new Topic(params, this._connection);


        return new Promise((resolve, reject) => {


            this._connection.send({
                action: 'topic_create',
                payload: {
                    name: topic.name,
                    permissions: topic.permissions,
                },
            }).then(() => {

                this.topics[topic.name] = topic;
                return resolve(topic);

            }).catch(err => {
                return reject(err);
            });

        });


    }
}
