import _ from 'lodash';
import url from 'url';
import { AvSessionConfig } from '../../types/index.js';
import NodeConfigurableServer from '../NodeConfigurableServer.js';
import { Protocol } from '../Protocol.js';
import { NodeAvSession } from './NodeAvSession.js';

class NodeAvServer extends NodeConfigurableServer {
    constructor() {
        super();
    }

    public handleHttpRequest(req: any, res: any) {
        if (!this.isRunning()) {
            res.sendStatus(404);
            return;
        }

        const streamApp = req.params.splat[0];
        const streamName = req.params.splat[1];
        const streamPath = '/' + streamApp + '/' + streamName;
        const streamQuery = req.query as any;
        const streamHost = req.hostname;
        const isPublisher = req.method === 'POST';

        this.createSession(req, res, {
            streamPath,
            streamQuery,
            streamApp,
            streamName,
            streamHost,
            isPublisher,
        });
    }

    public handleWsRequest(req: any, ws: any) {
        if (!this.isRunning()) {
            ws.close();
            return;
        }

        const urlInfo = url.parse(req.url, true);
        const streamHost = req.headers.host?.split(':')[0];
        const streamPath = urlInfo.pathname.split('.')[0];
        const streamApp = streamPath.split('/')[1];
        const streamName = streamPath.split('/')[2];
        const streamQuery = urlInfo.query as any;
        let isPublisher = false;
        if (ws.protocol.toLowerCase() === 'post' || ws.protocol.toLowerCase() === 'publisher') {
            isPublisher = true;
        }

        this.createSession(req, ws, {
            streamPath,
            streamQuery,
            streamApp,
            streamName,
            streamHost,
            isPublisher,
        });
    }

    private createSession(req: any, res: any, info: any) {
        const sessionConf: AvSessionConfig = {
            auth: _.cloneDeep(this.config.auth),
        };

        const remoteIp = (
            req.ip || req.socket.remoteAddress
        ) + ':' + req.socket.remotePort;
        let session = new NodeAvSession(sessionConf, remoteIp, Protocol.FLV, info);
        session.setTransport(req, res);
        session.run();
    }
}

export { NodeAvServer };
