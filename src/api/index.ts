import express from 'express';
import { Context } from '@vad-systems/nms-shared';
import fissionRoute from './routes/fission.js';
import relayRoute from './routes/relay.js';
import serverRoute from './routes/server.js';
import streamsRoute from './routes/streams.js';
import transRoute from './routes/trans.js';

export function setupRoutes(app: express.Application, context: Context) {
    app.use('/api/streams', streamsRoute(context));
    app.use('/api/server', serverRoute(context));
    app.use('/api/relay', relayRoute(context));
    app.use('/api/trans', transRoute(context));
    app.use('/api/fission', fissionRoute(context));
}
