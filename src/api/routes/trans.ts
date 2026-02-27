import express from 'express';
import { Context } from '../../types/index.js';
import transController from '../controllers/trans.js';

export default (context: Context) => {
    let router = express.Router();
    router.get('/', transController.getStreams.bind(context));
    router.delete('/:id', transController.delStream.bind(context));
    return router;
};
