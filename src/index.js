import http from 'http'
import express from 'express'
import cors from 'cors'
import Database from "./database";

const PORT = 3001;
const app = express();
app.server = http.createServer(app);

app.use(cors({
    exposedHeaders: "*"
}));

const database = new Database();

const ctx = {
    db: database,
    models: database.models()
};

ctx.models.user.save(null, {
    firstName: "Toan",
    lastName: "Nguyen Dinh",
    email: "toan@tabvn.com",
    password: "12345678",
    created: new Date()
}).then((model) => {

    console.log("Model created", model);
});
ctx.models.user.find({limit: 50}).then((items) => {
    //console.log("Items", items);
});

ctx.models.user.get('5aa64ce84c1cff1545bc7aa5');

ctx.models.user.count().then((c) => {
    console.log(c);
});
ctx.models.user.delete("5aa64ceff6c33f154bcd1ec9");

app.server.listen(PORT, () => {
    console.log(`App is running on port ${app.server.address().port}`);
});