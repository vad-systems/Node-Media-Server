import _ from 'lodash';
import url from 'url';
import { context } from '@vad-systems/nms-core';
import { AvSessionConfig } from '@vad-systems/nms-shared';
import { NodeConfigurableServer, Protocol } from '@vad-systems/nms-server';
import { NodeAvSession } from './NodeAvSession.js';

class NodeAvServer extends NodeConfigurableServer {
    constructor() {
        super();
        this.handleWsRequest = this.handleWsRequest.bind(this);
    }

    public attachHttpServer(httpServer: any) {
        httpServer.app.all('/{*splat}.flv', (req: any, res: any) => {
            this.handleHttpRequest(req, res);
        });
        context.nodeEvent.on('wsConnection', this.handleWsRequest);
    }

    public handleHttpRequest(req: any, res: any) {
        if (!this.isRunning()) {
            res.sendStatus(404);
            return;
        }

        const [streamApp, streamName] = req.params.splat;
        const streamPath = '/' + streamApp + '/' + streamName;
        const streamQuery = req.query as any;
        const streamHost = req.hostname;
        const isPublisher = req.method === 'POST';

        this.createSession(req, res, Protocol.HTTP_FLV, {
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

        this.createSession(req, ws, Protocol.WS_FLV, {
            streamPath,
            streamQuery,
            streamApp,
            streamName,
            streamHost,
            isPublisher,
        });
    }

    private createSession(req: any, res: any, protocol: Protocol, info: any) {
        const sessionConf: AvSessionConfig = {
            auth: _.cloneDeep(this.config.auth),
        };

        const remoteIp = (
            req.ip || req.socket.remoteAddress
        ) + ':' + req.socket.remotePort;
        let session = new NodeAvSession(sessionConf, remoteIp, protocol, info);
        session.setTransport(req, res);
        session.run();
    }
}

export { NodeAvServer };
