import get from 'lodash.get';
import Emitter from './emitter'
import {TopicManager} from "./topic";


export default class Connection {

    constructor(url) {
        this._url = url;
        this._event = new Emitter();
        this._connected = false;
        this._ws = null;
        this._timeout = null;
        this.connect = this.connect.bind(this);

        this._event.on('disconnect', () => {
            this.connect();
        });

        this.topic = new TopicManager(this);

    }

    connect() {

        return new Promise((resolve, reject) => {

            const ws = new WebSocket(this._url);
            this._ws = ws;
            ws.onopen = () => {
                this._connected = true;
                this._event.emit('connected', true);
                resolve(this);
            };

            ws.onmessage = (res) => {

                let message = res.data;

                if (typeof message === 'string') {

                    message = this.toJSON(message);

                    const action = get(message, 'action');
                    const payload = get(message, 'payload');


                    console.log("Server message: ", message);
                    switch (action) {

                        case '__reply__':

                            this._event.emit(`__reply__${payload}`, true);

                            break;

                        case 'topic_message':


                            const topicName = get(payload, 'name');
                            const topic = get(this.topic.topics, topicName, null);
                            if (topic) {

                                topic.send(get(payload, 'data'));
                            }


                            break;

                        default:

                            break;
                    }
                }

            };


            ws.onerror = () => {

                this._connected = false;
                this._event.emit('disconnect', true);
                reject("Connection error");
            };

            ws.onclose = () => {

                this._event.emit('disconnect', true);

                this._connected = false;
                reject("Connection Close");
            };


        })

    }


    /**
     * Listen event
     * @param event
     * @param cb
     */
    on(event, cb = () => {
    }) {
        this._event.on(event, cb);
    }

    /**
     * Listen event once time
     * @param event
     * @param cb
     */
    once(event, cb = () => {
    }) {
        this._event.once(event, cb);
    }

    /**
     * Create Topic
     * @param name
     * @returns {*}
     */
    createTopic(name, permissions = []) {

        return this.send({
            id: this.autoId(),
            action: 'topic',
            payload: {
                name: name,
                permissions: permissions
            },
        });

    }

    /**
     * Send message to server via WebSocket
     * @param message
     */
    send(message) {


        return new Promise((resolve, reject) => {
            if (this._connected) {

                let delivery = false;


                if (!message.id) {
                    message.id = this.autoId();
                }

                this._ws.send(JSON.stringify(message));

                const cb = (data) => {
                    delivery = true;
                    return resolve(data);
                };


                const key = `__reply__${get(message, 'id')}`;

                this.on(key, cb);

                this._timeout = setTimeout(() => {
                    if (!delivery) {
                        this._event.off(key, cb);
                        return reject("Unable send message to the server.");
                    } else {
                        clearTimeout(this._timeout);
                    }

                }, 10000);

            } else {
                return reject("You are not connected");
            }
        });
    }

    /**
     * Message from String to Json
     * @param message
     * @returns {*}
     */
    toJSON(message) {

        try {
            message = JSON.parse(message);
        }
        catch (err) {
            console.log(err);
        }
        return message;
    }


    /**
     * Auto ID
     * @returns {string}
     */
    autoId() {
        return Math.random().toString(36).substr(2, 10);
    }
}

/**
 * Test Only, remove this when build the library
 */
window.onload = (function () {

    const conn = new Connection('ws://localhost:3001/');
    conn.connect().then(() => {
        console.log("Client is connected");
    }).catch(err => {
        console.log("An error connecting", err);
    });

    conn.on('connected', () => {
        console.log("you are connected");

        conn.topic.create({name: 'toan', permissions: []}).then((topic) => {
            console.log("Topic created", topic);

            // send some data

            topic.subscribe((data) => {
                console.log("Got data from topic", topic, data);
            });

            topic.publish({hi: "there, how are you?"});


        }).catch(err => {

            console.log("Anable create topic");
        });

    })


});