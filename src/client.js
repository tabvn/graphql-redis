const WebSocket = require('uws');
const EventEmitter = require('events');

let connected = false;

let event = new EventEmitter();

const connect = () => {
    const ws = new WebSocket('ws://localhost:3001');

    ws.on('open', () => {
        console.log("Connected to the server");
        ws.on('message', (msg) => {
            console.log("Got message from the server", msg, new Date());

        });


        ws.send(JSON.stringify({
            action: 'pub',
            payload: {
                topic: 'tabvn:users:abc',
                data: {user: '1', email: "toan@tabvn.com"}
            }
        }))


        setInterval(() => {

            ws.send(JSON.stringify({hi: 'hi'}))
        }, 3000);


    });

    ws.on('close', () => {
        console.log("error");
        event.emit('disconnect', true);
    });

    ws.on('error', () => {
        console.log("An error connecting to server")
        event.emit('disconnect', true);
    });

}

connect();

event.on('disconnect', () => {
    connect();
})