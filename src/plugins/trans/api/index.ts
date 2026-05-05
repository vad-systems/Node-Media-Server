import express from 'express';
import { Context } from '@vad-systems/nms-shared';
import transController from './controller.js';

export default (context: Context) => {
    let router = express.Router();
    router.get('/', transController.getStreams.bind(context));
    router.delete('/:id', transController.delStream.bind(context));
    router.post('/restart/:id', transController.restartStream.bind(context));
    return router;
};
