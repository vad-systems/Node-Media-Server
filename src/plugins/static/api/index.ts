import express from 'express';
import * as controller from './controller.js';

export default (context: any) => {
    const router = express.Router();
    router.get('/', controller.getStatus);
    return router;
};
