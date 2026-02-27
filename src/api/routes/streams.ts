import express from 'express';
import { Context } from 'node:vm';
import streamController from '../controllers/streams.js';

export default (context: Context) => {
    let router = express.Router();
    router.get('/', streamController.getStreams.bind(context));
    router.get('/:app/:stream', streamController.getStream.bind(context));
    router.delete('/:app/:stream', streamController.delStream.bind(context));
    return router;
};
