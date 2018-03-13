import http from 'http'
import express from 'express'
import cors from 'cors'
import Database from "./database"
import graphqlHTTP from 'express-graphql'
import Schema from './schema'
import {production, port} from "./config"
import _ from 'lodash'

const PORT = port;
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


app.ctx = ctx;

const handleRequest = graphqlHTTP(async (request) => {

    let tokenId = request.header('authorization');
    if (!tokenId) {
        tokenId = _.get(request, 'query.auth', null);
    }
    request.ctx = ctx;

    let token = null;

    try {
        token = await ctx.models.token.verifyToken(tokenId);
    } catch (err) {
        console.log(err);
    }
    request.token = token;

    return {
        schema: new Schema(ctx).schema(),
        graphiql: !production,
    };
});


app.use('/api', handleRequest);


app.server.listen(PORT, () => {
    console.log(`App is running on port ${app.server.address().port}`);
});