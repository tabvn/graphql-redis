import http from 'http'
import cors from 'cors'
import graphqlHTTP from 'express-graphql'
import Schema from './schema'
import {production, port} from "./config"
import _ from 'lodash'

const PORT = port;
import Context from "./context";

const {app, database, pubSub, server} = new Context();

app.server = server;
app.use(cors({
    exposedHeaders: "*"
}));


const ctx = {
    pubSub: pubSub,
    models: database.models(),
};

app.use('/api', graphqlHTTP(async (request) => {

    let tokenId = request.header('authorization');
    if (!tokenId) {
        tokenId = _.get(request, 'query.auth', null);
    }
    request.ctx = ctx;

    let token = null;

    if (tokenId) {
        try {
            token = await ctx.models.token.verifyToken(tokenId);
        } catch (err) {
            console.log(err);
        }
    }
    request.token = token;
    return {
        schema: new Schema(ctx).schema(),
        graphiql: !production,
    };
}));


app.server.listen(PORT, () => {
    console.log(`App is running on port ${app.server.address().port}`);
});