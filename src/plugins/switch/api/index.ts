import express from 'express';
import { Context } from '@vad-systems/nms-shared';
import switchController from './controller.js';

export default (context: Context) => {
    let router = express.Router();
    router.post('/', switchController.switchSource.bind(context));
    router.get('/', switchController.getStatus.bind(context));
    return router;
};
