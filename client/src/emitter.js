export default class Emitter {


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