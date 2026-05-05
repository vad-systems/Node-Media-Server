import express from 'express';
import { Context } from '@vad-systems/nms-shared';
import serverRoute from './server.router.js';
import streamsRoute from './streams.router.js';
import { fissionApi } from '@vad-systems/nms-plugin-fission';
import { relayApi } from '@vad-systems/nms-plugin-relay';
import { transApi } from '@vad-systems/nms-plugin-trans';
import { switchApi } from '@vad-systems/nms-plugin-switch';
import { pluginEnabled } from './middleware.js';

export function setupRoutes(app: express.Application, context: Context) {
    const config = context.configProvider.getConfig();

    app.use('/api/streams', streamsRoute(context));
    app.use('/api/server', serverRoute(context));

    app.use('/api/relay', pluginEnabled('relay').bind(context), relayApi(context));
    app.use('/api/trans', pluginEnabled('trans').bind(context), transApi(context));
    app.use('/api/fission', pluginEnabled('fission').bind(context), fissionApi(context));
    app.use('/api/switch', pluginEnabled('switch').bind(context), switchApi(context));
}
