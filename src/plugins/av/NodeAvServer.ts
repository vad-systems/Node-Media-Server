import _ from 'lodash';
import url from 'url';
import express from 'express';
import WebSocket from 'ws';
import Http from 'http';
import { context } from '@vad-systems/nms-core';
import { AvSessionConfig } from '@vad-systems/nms-shared';
import { NodeConfigurableServer, Protocol, NodeHttpServer } from '@vad-systems/nms-server';
import { NodeAvSession } from '@vad-systems/nms-plugin-av';

class NodeAvServer extends NodeConfigurableServer {
    constructor() {
        super();
        this.handleWsRequest = this.handleWsRequest.bind(this);
    }

    private isAttached = false;

    public attachHttpServer(httpServer: NodeHttpServer) {
        if (this.isAttached) {
            return;
        }
        httpServer.app.all('/{*splat}.flv', (req: express.Request, res: express.Response) => {
            this.handleHttpRequest(req, res);
        });
        context.nodeEvent.on('wsConnection', this.handleWsRequest);
        this.isAttached = true;
    }

    public async run() {
        await super.run();
        const server = context.server as any;
        if (server?.httpServer?.isRunning()) {
            this.attachHttpServer(server.httpServer);
        }
    }

    public handleHttpRequest(req: express.Request, res: express.Response) {
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

    public handleWsRequest(ws: WebSocket, req: Http.IncomingMessage) {
        if (!this.isRunning()) {
            ws.close();
            return;
        }

        const urlInfo = url.parse(req.url, true);
        const streamHost = req.headers.host?.split(':')[0];
        const pathname = urlInfo.pathname || '';
        const streamPath = pathname.split('.')[0];
        const streamApp = streamPath.split('/')[1];
        const streamName = streamPath.split('/')[2];
        const streamQuery = urlInfo.query as any;
        let isPublisher = false;
        if (ws.protocol && (
            ws.protocol.toLowerCase() === 'post' || ws.protocol.toLowerCase() === 'publisher'
        )) {
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

    private createSession(req: Http.IncomingMessage | express.Request, res: WebSocket | express.Response, protocol: Protocol, info: any) {
        const sessionConf: AvSessionConfig = {
            auth: _.cloneDeep(this.config.auth),
        };

        const remoteIp = (
            (
                req as any
            ).ip || req.socket.remoteAddress
        ) + ':' + req.socket.remotePort;
        let session = new NodeAvSession(sessionConf, remoteIp, protocol, info);
        session.setTransport(req, res);
        session.run();
    }
}

export { NodeAvServer };
