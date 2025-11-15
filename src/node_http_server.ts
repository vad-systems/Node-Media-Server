import basicAuth from 'basic-auth-connect';
import bodyParser from 'body-parser';
import Express from 'express';
import fs, { PathLike } from 'fs';
import Http from 'http';
import H2EBridge from 'http2-express';
import Https from 'https';
import _ from 'lodash';
import path from 'path';
import WebSocket from 'ws';
import relayRoute from './api/routes/relay.js';
import serverRoute from './api/routes/server.js';
import streamsRoute from './api/routes/streams.js';
import { context, Logger } from './core/index.js';
import NodeConfigurableServer from './node_configurable_server.js';
import { NodeHttpSession } from './node_http_session.js';
import { NodeRtmpSession } from './node_rtmp_session.js';
import { Arguments, HttpSessionConfig, NodeConnectionType, NodeHttpRequest, NodeHttpResponse, SessionID } from './types/index.js';

const HTTP_PORT = 80;
const HTTPS_PORT = 443;
const HTTP_MEDIAROOT = './media';

class NodeHttpServer extends NodeConfigurableServer {
    private mediaroot: PathLike;
    private port: number;
    private httpServer: Http.Server;
    private wsServer: WebSocket.Server;

    private sport?: number;
    private httpsServer?: Https.Server;
    private wssServer?: WebSocket.Server;

    constructor() {
        super();
        this.onPostPlay = this.onPostPlay.bind(this);
        this.onPostPublish = this.onPostPublish.bind(this);
        this.onDoneConnect = this.onDoneConnect.bind(this);
    }

    initServer() {
        this.port = this.config.http.port || HTTP_PORT;
        this.mediaroot = this.config.http.mediaroot || HTTP_MEDIAROOT;

        const app = H2EBridge(Express);
        app.use(bodyParser.json());

        app.use(bodyParser.urlencoded({ extended: true }));

        app.all('/{*splat}', (req: Express.Request, res: Express.Response, next: Express.NextFunction) => {
            res.header('Access-Control-Allow-Origin', this.config.http.allow_origin);
            res.header(
                'Access-Control-Allow-Headers',
                'Content-Type,Content-Length, Authorization, Accept,X-Requested-With',
            );
            res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS');
            res.header('Access-Control-Allow-Credentials', 'true');
            req.method === 'OPTIONS' ? res.sendStatus(200) : next();
        });

        app.get('/{*splat}.flv', (req: Express.Request, res: Express.Response, next: Express.NextFunction) => {
            const nmsReq = {
                req,
                nmsConnectionType: NodeConnectionType.HTTP,
                remoteAddress: req.ip,
            };
            const nmsRes = {
                res,
            };
            this.handleConnect(nmsReq, nmsRes);
        });

        const adminEntry = path.join(__dirname + '/../public/admin/index.html');
        if (fs.existsSync(adminEntry)) {
            app.get('/admin/*splat', (req: Express.Request, res: Express.Response) => {
                res.sendFile(adminEntry);
            });
        }

        if (this.config.http.api !== false) {
            if (this.config.auth && this.config.auth.api) {
                app.use(
                    ['/api/*splat', '/static/*splat', '/admin/*splat'],
                    basicAuth(this.config.auth.api_user, this.config.auth.api_pass),
                );
            }
            app.use('/api/streams', streamsRoute(context));
            app.use('/api/server', serverRoute(context));
            app.use('/api/relay', relayRoute(context));
        }

        app.use(Express.static(path.join(__dirname + '/../public')));
        app.use(Express.static(this.mediaroot.toString()));
        if (this.config.http.webroot) {
            app.use(Express.static(this.config.http.webroot));
        }

        this.httpServer = Http.createServer(app);

        if (this.config.https) {
            let options = {
                key: fs.readFileSync(this.config.https.key),
                cert: fs.readFileSync(this.config.https.cert),
            };
            if (this.config.https.passphrase) {
                Object.assign(options, { passphrase: this.config.https.passphrase });
            }
            this.sport = this.config.https.port || HTTPS_PORT;
            this.httpsServer = Https.createServer(options, app);
        }
    }

    async run() {
        await super.run();

        this.initServer();

        this.httpServer.listen(this.port, () => {
            Logger.log(`Node Media Http Server started on port: ${this.port}`);
        });

        this.httpServer.on('error', (e) => {
            Logger.error(`Node Media Http Server ${e}`);
        });

        this.httpServer.on('close', () => {
            Logger.log('Node Media Http Server closed');
        });

        this.wsServer = new WebSocket.Server({ server: this.httpServer });

        this.wsServer.on('connection', (ws: WebSocket.WebSocket, req: Http.IncomingMessage) => {
            const nmsReq = {
                req,
                nmsConnectionType: NodeConnectionType.WS,
                remoteAddress: req.socket.remoteAddress,
            };
            const nmsRes = {
                res: ws,
            };
            this.handleConnect(nmsReq, nmsRes);
        });

        this.wsServer.on('listening', () => {
            Logger.log(`Node Media WebSocket Server started on port: ${this.port}`);
        });
        this.wsServer.on('error', (e) => {
            Logger.error(`Node Media WebSocket Server ${e}`);
        });
        this.wsServer.on('close', () => {
            Logger.log(`Node Media WebSocket Server closed`);
        });

        if (this.httpsServer) {
            this.httpsServer.listen(this.sport, () => {
                Logger.log(`Node Media Https Server started on port: ${this.sport}`);
            });

            this.httpsServer.on('error', (e) => {
                Logger.error(`Node Media Https Server ${e}`);
            });

            this.httpsServer.on('close', () => {
                Logger.log('Node Media Https Server Close.');
            });

            this.wssServer = new WebSocket.Server({ server: this.httpsServer });

            this.wssServer.on('connection', (ws, req) => {
                const nmsReq = {
                    req,
                    nmsConnectionType: NodeConnectionType.WS,
                    remoteAddress: req.socket.remoteAddress,
                };
                const nmsRes = {
                    res: ws,
                };
                this.handleConnect(nmsReq, nmsRes);
            });

            this.wssServer.on('listening', () => {
                Logger.log(`Node Media WebSocketSecure Server started on port: ${this.sport}`);
            });
            this.wssServer.on('error', (e) => {
                Logger.error(`Node Media WebSocketSecure Server ${e}`);
            });
            this.wssServer.on('close', () => {
                Logger.log(`Node Media WebSocketSecure Server closed`);
            });
        }

        context.nodeEvent.on('postPlay', this.onPostPlay);
        context.nodeEvent.on('postPublish', this.onPostPublish);
        context.nodeEvent.on('doneConnect', this.onDoneConnect);
    }

    onPostPlay(id: SessionID, streamPath: string, args: Arguments) {
        context.stat.accepted++;
    }

    onPostPublish(id: SessionID, streamPath: string, args: Arguments) {
        context.stat.accepted++;
    }

    onDoneConnect(id: SessionID, connectCmdObj: any) {
        let session = context.sessions.get(id);

        if (session instanceof NodeHttpSession) {
            let socket = session.req.socket;
            context.stat.inbytes += socket.bytesRead;
            context.stat.outbytes += socket.bytesWritten;
        } else if (session instanceof NodeRtmpSession) {
            let socket = session.socket;
            context.stat.inbytes += socket.bytesRead;
            context.stat.outbytes += socket.bytesWritten;
        }
    }

    stop() {
        super.stop();

        context.nodeEvent.off('postPlay', this.onPostPlay);
        context.nodeEvent.off('postPublish', this.onPostPublish);
        context.nodeEvent.off('doneConnect', this.onDoneConnect);

        this.httpServer.close();
        if (this.httpsServer) {
            this.httpsServer.close();
        }

        this.wsServer.close();
        if (this.wssServer) {
            this.wssServer.close();
        }

        context.sessions.forEach((session, id) => {
            if (session instanceof NodeHttpSession) {
                session.req.destroy();
                context.sessions.delete(id);
            }
        });

        Logger.log(`Node Media Http Server stopped.`);
    }

    handleConnect(req: NodeHttpRequest, res: NodeHttpResponse) {
        const sessionConf: HttpSessionConfig = {
            auth: _.cloneDeep(this.config.auth),
        };
        let session = new NodeHttpSession(sessionConf, req, res);
        session.run();
    }
}

export { NodeHttpServer };
