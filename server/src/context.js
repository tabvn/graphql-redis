import http from 'http'
import express from 'express'
import Database from "./database";
import WebSocketServer from 'uws'
import PubSub from "./pubsub";

const app = express();
const server = http.createServer(app);
const database = new Database();
const wss = new WebSocketServer.Server({
    server: server
});



const pubSub = new PubSub(wss, database);

export default class Context {
    constructor() {
        this.app = app;
        this.server = server;
        this.database = database;
        this.pubSub = pubSub;
    }
}