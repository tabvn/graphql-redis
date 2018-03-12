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
}).catch((err) => {
    console.log("Unable save model", err);
});

app.server.listen(PORT, () => {
    console.log(`App is running on port ${app.server.address().port}`);
});