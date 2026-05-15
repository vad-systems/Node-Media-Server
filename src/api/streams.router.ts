import express from 'express';
import { Context } from '@vad-systems/nms-shared';
import streamController from './streams.controller.js';

export default (context: Context) => {
    let router = express.Router();
    router.get('/', streamController.getStreams.bind(context));
    router.get('/tree', streamController.getStreamsTree.bind(context));
    router.get('/:app/:stream', streamController.getStream.bind(context));
    router.delete('/:app/:stream', streamController.delStream.bind(context));
    router.post('/:app/:stream/stop', streamController.stopBroadcast.bind(context));
    router.post('/session/:id/start', streamController.startSession.bind(context));
    router.post('/session/:id/stop', streamController.stopSession.bind(context));
    router.post('/session/:id/restart', streamController.restartSession.bind(context));
    return router;
};
