import express from 'express';
import { Context } from '@vad-systems/nms-shared';
import serverRoute from './server.router.js';
import streamsRoute from './streams.router.js';
import { fissionApi } from '@vad-systems/nms-plugin-fission';
import { relayApi } from '@vad-systems/nms-plugin-relay';
import { transApi } from '@vad-systems/nms-plugin-trans';

export function setupRoutes(app: express.Application, context: Context) {
    const config = context.configProvider.getConfig();

    app.use('/api/streams', streamsRoute(context));
    app.use('/api/server', serverRoute(context));

    if (config.relay) {
        app.use('/api/relay', relayApi(context));
    }
    if (config.trans) {
        app.use('/api/trans', transApi(context));
    }
    if (config.fission) {
        app.use('/api/fission', fissionApi(context));
    }
}
