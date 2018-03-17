import "babel-polyfill"
import {Map} from 'immutable'
import EventEmitter from 'events'
import ObjectID from '../lib/objectid'
import _ from 'lodash'
import Topic from './topic'
export default class PubSub {

    constructor(wss, database) {

        this._wss = wss;
        this._db = database;
        this._topics = new Map();
        this._clients = new Map();
        this._pubSubEvent = new EventEmitter();
        this._listeners = new Map();

        wss.on('connection', (ws) => {

            console.log("new client connected");


            const clientId = new ObjectID();

            const client = {
                id: clientId,
                user: null,
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

                    const action = _.get(message, 'action');
                    const payload = _.get(message, 'payload');
                    const id = _.get(message, 'id');

                      //confirm we received this message
                      ws.send(JSON.stringify({
                            action: '__reply__',
                            payload: id,
                      }));

                    switch(action){

                        case 'auth':
                                this.authenticate(payload, clientId);
                            break;

                        case 'topic':
                                this.createTopic(payload, clientId);

                            break;

                        default:
                            break;
                    }
                    console.log(`Message from Client ${clientId}`, message, this._clients.size);

                } else {
                    // handle data message later.
                }

                message = _.setWith(message, '_ID', clientId);

                this.createTopic('test_' + clientId).then(() => {

                    this.sub('test_' + clientId, clientId);



                    this.pub('test_' + clientId, message);
                });
                

            });


           


        });

    }

    /**
     * Authenticate client
     * @param token
     * @param clientId
     * @returns {Promise<void>}
     */
    async authenticate(token, clientId){

        let decoded = null;
        let user = null;

        try{
             decoded = await this._db.models().token.verifyToken(token);
        }
        catch(err){
            console.log(err);
        }
        if(decoded){
            const userId = _.get(decoded, 'userId');

            try{
                user = await this._db.models().user.get(userId);
            }
            catch(err){
                console.log(err);
            }
            let client = this.getClient(clientId);
            if(client){
                client.user = user;
                this.addClient(clientId, client);
            }
        }
    }

    /**
     * Get topic by name
     * @param name
     * @returns {V | undefined}
     */
    getTopic(name){


        return this._topics.get(name);
    }

    /**
     * Create topic
     * @param name
     * @param clientId
     * @param permissions
     * @returns {Promise<any>}
     */
    createTopic(name, clientId = null, permissions = []){

        const client = this.getClient(clientId);
        const userId = _.get(client, 'user.id', null);

        return new Promise((resolve, reject) => {
            const topic = new Topic(name, userId, permissions);
            this._topics = this._topics.set(name, topic);
            return resolve(topic);
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
    pub(topicName, data) {

        const topic = this.getTopic(topicName);
        if(topic){
            this._pubSubEvent.emit(topicName, data);
        }
        
    }

    /**
     * Client subscribe a topic
     * @param topic
     * @param clientId
     */
    sub(topicName, clientId) {

        
        const topic = this.getTopic(topicName);

        


        if(topic){

             let listener = this.getListenerFunc(topicName, clientId);
            if (listener) {
                return;
            }

            listener = (data) => {

                

                this.sendMessageToClient(clientId, {
                    action: 'sub_message',
                    payload: {
                        topic: topicName,
                        data: data,
                    },
                })
            };

            // check permission before add to subscriber list
            const client = this.getClient(clientId);
            const isAllow = topic.checkAccess(_.get(client, 'user'));

            if(isAllow){
                 this.setListenerFunc(topic, clientId, listener);
                 this._pubSubEvent.on(topicName, listener);
            }
           
        }

       


    }

    /**
     * SubScribe topic
     * @param topic
     * @param clientId
     */
    unSub(topicName, clientId) {

        const listener = this.getListenerFunc(topicName, clientId);

        if (listener) {
            this._pubSubEvent.removeListener(topicName, listener);
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