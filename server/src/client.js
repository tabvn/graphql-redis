const WebSocket = require('uws');
const EventEmitter = require('events');

let connected = false;

let event = new EventEmitter();

let count = 0;
let error = 0;


const connect = () => {
    const ws = new WebSocket('ws://localhost:3001');

    ws.on('open', () => {

        count = count +1;

        console.log("Connected to the server: ", count);
        ws.on('message', (msg) => {
           // console.log("Got message from the server", msg, new Date());

        });



        ws.send(JSON.stringify({
            action: 'auth',
            payload:  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1YWFiM2QzZDIzMDUzMDA1NjQ2N2JlNTciLCJpYXQiOjE1MjEyNTY4MDR9.zS5Udnq3JhqrcJWjtOSDfTT3cdZgdHrDoiSmo3hq9hc",
        }));


           ws.send(JSON.stringify({
            action: 'pub',
            payload: {
                topic: 'tabvn:users:abc',
                data: {user: '1', email: "toan@tabvn.com"}
            }
        }));


        setInterval(() => {

            ws.send(JSON.stringify({hi: 'hi'}))
        }, 3000);


    });


    ws.on('close', () => {
        error = error +1;
        count = count -1;
        console.log("error", error, count);
        event.emit('disconnect', true);
    });

    ws.on('error', () => {
        error = error +1;
        console.log("An error connecting to server", error);

        event.emit('disconnect', true);
    });

}


 connect();



event.on('disconnect', () => {
   connect();
})