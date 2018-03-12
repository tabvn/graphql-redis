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


app.server.listen(PORT, () => {
    console.log(`App is running on port ${app.server.address().port}`);
});