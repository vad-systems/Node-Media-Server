import express from 'express';
import { Context } from '../../types/index.js';
import fissionController from '../controllers/fission.js';

export default (context: Context) => {
    let router = express.Router();
    router.get('/', fissionController.getStreams.bind(context));
    router.delete('/:id', fissionController.delStream.bind(context));
    return router;
};
