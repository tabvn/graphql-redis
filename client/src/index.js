class Emitter {

   
    on(event, listener) {
        // Use the current collection or create it.
        this._eventCollection = this._eventCollection || {};

        // Use the current collection of an event or create it.
        this._eventCollection[event] = this._eventCollection[event] || [];

        // Appends the listener into the collection of the given event
        this._eventCollection[event].push(listener);

        return this;
    }

    
    once(event, listener) {
        const self = this;

        function fn() {
            self.off(event, fn);
            listener.apply(this, arguments);
        }

        fn.listener = listener;

        this.on(event, fn);

        return this;
    }

    
    off(event, listener) {

        let listeners;

        // Defines listeners value.
        if (!this._eventCollection || !(listeners = this._eventCollection[event])) {
            return this;
        }

        listeners.forEach((fn, i) => {
            if (fn === listener || fn.listener === listener) {
                // Removes the given listener.
                listeners.splice(i, 1);
            }
        });

        // Removes an empty event collection.
        if (listeners.length === 0) {
            delete this._eventCollection[event];
        }

        return this;
    }

    
    emit(event, ...args) {
        let listeners;

        // Defines listeners value.
        if (!this._eventCollection || !(listeners = this._eventCollection[event])) {
            return this;
        }

        // Clone listeners
        listeners = listeners.slice(0);

        listeners.forEach(fn => fn.apply(this, args));

        return this;
    }

}



class Lodash {

	get(object, path){
		return path.
        replace(/\[/g, '.').
        replace(/\]/g, '').
        split('.').
        reduce((o, k) => (o || {})[k], object);
	}
}

const _ = new Lodash();


class Client{

	constructor(url){

		this._url = url;
		this._event = new Emitter();
		this._connected = false;
		this._ws = null;


		this.connect = this.connect.bind(this);
		this._event.on('disconnect', () => {
			this.connect();
		});
	}

	
	connect(){

		return new Promise((resolve, reject) => {

			const ws = new WebSocket(this._url);
			this._ws = ws;

			ws.onopen = () => {

				this._connected = true;
				this._event.emit('connected', true);




				resolve(this);



			}

			ws.onmessage = (reponse) => {
				

					let message = reponse.data;

					if(typeof message === 'string'){

						message = this.toJSON(message);

						const action = _.get(message, 'action');
						const payload = _.get(message, 'payload');

						

						switch(action){

							case '__reply__':

								

								this._event.emit(`__reply__${payload}`, true);

								break;


							default:

								break;
						}
					}

				};


			ws.onerror = () => {

				this._connected = false;
				this._event.emit('disconnect', true);

				reject("Can not connect to the server.");
			}
			ws.onclose = () => {

				this._event.emit('disconnect', true);
				this._connected = false;
				reject("Closed");
			}

		

		})
	
	}

	on(event, cb = () => {}){
		this._event.on(event, cb);
	}

	createTopic(name){

		return this.send({
			id: this.autoId(),
			action: 'topic',
			payload: name,
		});

	}

	send(message){
		return new Promise((resolve, reject) => {

			if(this._connected){
				this._ws.send(JSON.stringify(message));
				const cb = resolve;
				this.on(`__reply__${_.get(message, 'id')}`, cb);

			}else{

				return reject("You are not connected");
			}
		});
	}
	toJSON(message){

		try{
			message = JSON.parse(message);
		}
		catch(err){
			console.log(err);
		}
		return message;
	}

	
	autoId(len = 40){
		return Math.random().toString(36).substr(2, 5);
	}
}


window.onload = (function(){

	const client = new Client('ws://localhost:3001/');

	client.connect().then(() => {
		console.log("Client is connected");
	}).catch(err => {

		console.log("An error connecting", err);
	});

	client.on('connected', () => {
		console.log("you are connected");

			client.createTopic('toan').then(() => {

			console.log("Your topic has created");

		})
	})

	
});