import express from 'express';
import { Context } from '../../types/index.js';
import serverController from '../controllers/server.js';

export default (context: Context) => {
    let router = express.Router();
    router.get('/', serverController.getInfo.bind(context));
    router.get('/config', serverController.getConfig.bind(context));
    router.patch('/config', serverController.updateConfig.bind(context));
    return router;
};
