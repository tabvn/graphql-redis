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

```javascript
  const conn = new Connection('ws://localhost:3001/');

      conn.connect().then(() => {
          console.log("You are connected to the server.");

          const Topic = conn.topic;

          // let create new Topic
          Topic.create({name: 'toan', permissions: []}).then((topic) => {
              console.log("Topic created", topic);

              // let subscribe to this topic for next incomming messages
              topic.subscribe((data) => {
                  console.log("Got message from topic", data);
              });

              // let publish sample message data
              topic.publish({hi: "there, how are you?"});


          }).catch(err => {
              console.log("An error create topic", err);
          });


      }).catch(err => {
          console.log("An error connecting", err);
      });

    
```
