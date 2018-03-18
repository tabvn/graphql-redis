## Development

```
npm install
```

```
npm start
```

## Production Build

```
npm run build
```


## Idea

```
  const connection = new Connection('ws://localhost:3001/');
    
    connection.connect().then(() => {
        console.log("Client is connected");
        
        // let create new topic for realtime subscribe
        const permissions = [{type: 'role', value: ['administrator', 'staff']}];
        // or const permissions = [{type: 'user', value: ['*']}]; // allow any user subscribe this topic
        
        connection.createTopic("name-of-topic", permissions).then(() => {
           
           
           console.log("Topic is created");
           
           // now let subscribe this topic if new message publish
           
           connection.sub("name-of-topic", (data) => {
            console.log("New mesage from the topic", data);
           });
           
           // let test publish the message to topic
           const message = {any: "info"};
           connection.pub('name-of-topic', message).then((info) => {
              console.log("Message sent to subscribe", info, info.subscribersCount);
              
           });
           
           
           
           
        });
       
        
        
    }).catch(err => {
        console.log("An error connecting", err);
    });

    
```
