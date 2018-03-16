import {Map} from 'immutable'
import EventEmitter from 'events'
import ObjectID from '../lib/objectid'
import _ from 'lodash'

export default class PubSub {

    constructor(wss) {

        this._topics = new Map();
        this._clients = new Map();
        this._pubSubEvent = new EventEmitter();
        this._listeners = new Map();

        wss.on('connection', (ws) => {

            console.log("new client connected");


            const clientId = new ObjectID();

            const client = {
                id: clientId,
                userId: null,
                authenticated: false,
                subs: new Map(),
                ws: ws,
            };

            // save client to the list
            this.addClient(clientId, client);

            ws.on('close', () => {
                console.log("Client disconnected");
                this.removeClient(clientId);
            });


            ws.on('message', (message) => {

                if (typeof message === 'string') {
                    message = this.toJson(message);
                    console.log(`Message from Client ${clientId}`, message);

                } else {
                    // handle data message later.
                }

                message = _.setWith(message, '_ID', clientId);
                this.pub('test_' + clientId, message);

            });


            this.sub('test_' + clientId, clientId);


        });

    }

    /**
     * Add client to the list
     * @param id
     * @param client
     */
    addClient(id, client) {
        if (!id) {
            id = uuid();

        }

        this._clients = this._clients.set(id, client);
    }

    /**
     * Remove client
     * @param id
     */
    removeClient(id) {
        this._clients = this._clients.remove(id);
        this.unSubAll(null, id);
    }

    /**
     * Get client
     * @param id
     * @returns {V | undefined}
     */
    getClient(id) {
        return this._clients.get(id);
    }

    /**
     * Public message to topic
     * @param topic
     * @param data
     */
    pub(topic, data) {

        this._topics = this._topics.set(topic, true);
        this._pubSubEvent.emit(topic, data);
    }

    /**
     * Client subscribe a topic
     * @param topic
     * @param clientId
     */
    sub(topic, clientId) {

        this._topics = this._topics.set(topic, true);

        let listener = this.getListenerFunc(topic, clientId);
        if (listener) {
            return;
        }

        listener = (data) => {

            console.log("receive ", clientId, data);

            this.sendMessageToClient(clientId, {
                action: 'sub_message',
                payload: {
                    topic: topic,
                    data: data,
                },
            })
        };
        this.setListenerFunc(topic, clientId, listener);
        this._pubSubEvent.on(topic, listener);


    }

    /**
     * SubScribe topic
     * @param topic
     * @param clientId
     */
    unSub(topic, clientId) {

        const listener = this.getListenerFunc(topic, clientId);

        if (listener) {
            this._pubSubEvent.removeListener(topic, listener);
        }

    }

    /**
     * UnSubscribe
     * @param topic
     * @param clientId
     */
    unSubAll(topic = null, clientId = null) {


        let listeners = this._listeners;
        if (topic !== null && clientId !== null) {
            listeners = this._listeners.filter((item) => item.topic === topic && item.clientId === clientId);
        } else if (topic === null) {
            listeners = this._listeners.filter((item) => item.clientId === clientId);
        } else if (clientId === null) {
            listeners = this._listeners.filter((item) => item.topic === topic);
        } else {
            listeners = this._listeners;
        }
        // remove listener
        listeners.forEach((v, k) => {
            console.log("Begin unsc", v);
            this.unSub(v.topic, clientId);
        });


    }

    /**
     * Return listener function
     * @param topic
     * @param clientId
     * @returns {*}
     */
    getListenerFunc(topic, clientId) {
        const listenerKey = `${clientId}__${topic}`;
        const listener = this._listeners.get(listenerKey);
        if (listener) {
            return listener.func;
        }
        return null;
    }

    /**
     * Save listener functions
     * @param topic
     * @param clientId
     * @param listener
     */
    setListenerFunc(topic, clientId, listener) {
        const listenerKey = `${clientId}__${topic}`;
        this._listeners = this._listeners.set(listenerKey, {
            clientId: clientId,
            func: listener,
            topic: topic
        });
    }

    /**
     * Send Message to Client
     * @param clientId
     * @param data
     */
    sendMessageToClient(clientId, data) {

        if (typeof data !== 'string') {
            data = JSON.stringify(data);
        }
        const client = this.getClient(clientId);


        if (client) {
            client.ws.send(data);
        }
    }

    /**
     * Message from Json String to JSON format
     * @param message
     * @returns {*}
     */
    toJson(message) {

        try {
            message = JSON.parse(message);
        } catch (err) {
            console.log(err);
        }
        return message;
    }

}