import _ from 'lodash'

export default class Client {

    constructor(client) {
        this.id = _.get(client, 'id');
        this.ws = _.get(client, 'ws', null);
        this.user = _.get(client, 'user');
        this.created = new Date();
        this._topics = new Map();

        this.send = this.send.bind(this);
        this.subscribe = this.subscribe.bind(this);
        this.ubsubscribe = this.ubsubscribe.bind(this);
        this.disconnect = this.disconnect.bind(this);

    }

    /**
     * Subscribe to a topic
     * @param topic
     */
    subscribe(topic) {
        this._topics = this._topics.set(topic.id, topic);
        topic.subscribe(this);
    }

    /**
     * Unubscribe topic
     * @param topic
     */
    ubsubscribe(topic) {
        this._topics = this._topics.remove(topic.id);
        topic.ubsubscribe(this);
    }

    /**
     * Send data to the websocket client
     * @param data
     */
    send(data) {

        if (this.ws) {
            this.ws.send(this._toJSON(data));
        }

    }

    /**
     * Client is disconnect
     */
    disconnect() {

        this._topics.forEach((topic, key) => {
            this.user = null;
            this.ws = null;
            this.ubsubscribe(topic);
        });
    }

    /**
     * Message Object to JSON
     * @param data
     * @returns {*}
     * @private
     */
    _toJSON(data) {

        try {
            data = JSON.stringify(data);
        }
        catch (err) {
            console.log(err);
        }
        return data;
    }
}