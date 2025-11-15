import express from 'express';
import { Context } from '../../types/index.js';
import relayController from '../controllers/relay.js';

export default (context: Context) => {
    let router = express.Router();
    router.get('/', relayController.getStreams.bind(context));
    router.get('/:id', relayController.getStreamByID.bind(context));
    router.get('/:app/:name', relayController.getStreamByName.bind(context));
    router.delete('/:id', relayController.delStream.bind(context));
    return router;
};
