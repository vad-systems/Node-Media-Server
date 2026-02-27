import basicAuth from 'basic-auth-connect';
import bodyParser from 'body-parser';
import Express from 'express';
import fs, { PathLike } from 'fs';
import Http from 'http';
import H2EBridge from 'http2-express';
import Https from 'https';
import path from 'path';
import WebSocket from 'ws';
import { setupRoutes } from '@vad-systems/nms-api';
import { context, LoggerFactory } from '@vad-systems/nms-core';
import { Config } from '@vad-systems/nms-shared';
import { Protocol } from '../base/Protocol.js';
import { NodeSession } from '../base/NodeSession.js';
import { BaseAvSession } from '../base/BaseAvSession.js';

const DEFAULTHTTP_PORT = 80;
const DEFAULT_HTTPS_PORT = 443;
const HTTP_MEDIAROOT = './media';

class NodeHttpServer {
    private mediaroot: PathLike;
    private port: number;
    private httpServer: Http.Server;
    private wsServer: WebSocket.Server;

    private sport?: number;
    private httpsServer?: Https.Server;
    private wssServer?: WebSocket.Server;
    private logger = LoggerFactory.getLogger('HTTP Server');
    private config: Config;
    public app: Express.Application;

    constructor() {
        this.config = context.configProvider.getConfig();
        context.nodeEvent.on('configChanged', () => {
            this.config = context.configProvider.getConfig();
        });
    }

    public isRunning() {
        return !!this.httpServer;
    }

    initServer() {
        this.port = this.config.http.port || DEFAULTHTTP_PORT;
        this.mediaroot = this.config.http.mediaroot || HTTP_MEDIAROOT;

        this.app = H2EBridge(Express);
        this.app.use(bodyParser.json());

        this.app.use(bodyParser.urlencoded({ extended: true }));

        this.app.all('/{*splat}', (req: Express.Request, res: Express.Response, next: Express.NextFunction) => {
            res.header('Access-Control-Allow-Origin', this.config.http.allow_origin);
            res.header(
                'Access-Control-Allow-Headers',
                'Content-Type,Content-Length, Authorization, Accept,X-Requested-With',
            );
            res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS');
            res.header('Access-Control-Allow-Credentials', 'true');
            req.method === 'OPTIONS' ? res.sendStatus(200) : next();
        });

        const adminEntry = path.join(__dirname + '/../../../public/admin/index.html');
        if (fs.existsSync(adminEntry)) {
            this.app.get('/admin/*splat', (req: Express.Request, res: Express.Response) => {
                res.sendFile(adminEntry);
            });
        }

        if (this.config.http.api !== false) {
            if (this.config.auth && this.config.auth.api) {
                this.app.use(
                    ['/api/*splat', '/static/*splat', '/admin/*splat'],
                    basicAuth(this.config.auth.api_user, this.config.auth.api_pass),
                );
            }
            setupRoutes(this.app, context);
        }

        this.app.use(Express.static(path.join(__dirname + '/../../../public')));
        this.app.use(Express.static(this.mediaroot.toString()));
        if (this.config.http.webroot) {
            this.app.use(Express.static(this.config.http.webroot));
        }

        this.httpServer = Http.createServer(this.app);

        if (this.config.https) {
            let options = {
                key: fs.readFileSync(this.config.https.key),
                cert: fs.readFileSync(this.config.https.cert),
            };
            if (this.config.https.passphrase) {
                Object.assign(options, { passphrase: this.config.https.passphrase });
            }
            this.sport = this.config.https.port || DEFAULT_HTTPS_PORT;
            this.httpsServer = Https.createServer(options, this.app);
        }
    }

    async run() {
        this.initServer();

        this.httpServer.listen(this.port, () => {
            this.logger.log(`Node Media Http Server started on port: ${this.port}`);
        });

        this.httpServer.on('error', (e) => {
            this.logger.error(`Node Media Http Server ${e}`);
        });

        this.httpServer.on('close', () => {
            this.logger.log('Node Media Http Server closed');
        });

        this.wsServer = new WebSocket.Server({ server: this.httpServer });

        this.wsServer.on('connection', (ws: WebSocket.WebSocket, req: Http.IncomingMessage) => {
            context.nodeEvent.emit('wsConnection', ws, req);
        });

        this.wsServer.on('listening', () => {
            this.logger.log(`Node Media WebSocket Server started on port: ${this.port}`);
        });
        this.wsServer.on('error', (e) => {
            this.logger.error(`Node Media WebSocket Server ${e}`);
        });
        this.wsServer.on('close', () => {
            this.logger.log(`Node Media WebSocket Server closed`);
        });

        if (this.httpsServer) {
            this.httpsServer.listen(this.sport, () => {
                this.logger.log(`Node Media Https Server started on port: ${this.sport}`);
            });

            this.httpsServer.on('error', (e) => {
                this.logger.error(`Node Media Https Server ${e}`);
            });

            this.httpsServer.on('close', () => {
                this.logger.log('Node Media Https Server Close.');
            });

            this.wssServer = new WebSocket.Server({ server: this.httpsServer });

            this.wssServer.on('connection', (ws, req) => {
                context.nodeEvent.emit('wsConnection', ws, req);
            });

            this.wssServer.on('listening', () => {
                this.logger.log(`Node Media WebSocketSecure Server started on port: ${this.sport}`);
            });
            this.wssServer.on('error', (e) => {
                this.logger.error(`Node Media WebSocketSecure Server ${e}`);
            });
            this.wssServer.on('close', () => {
                this.logger.log(`Node Media WebSocketSecure Server closed`);
            });
        }
    }

    stop() {
        this.httpServer.close();
        if (this.httpsServer) {
            this.httpsServer.close();
        }

        this.wsServer.close();
        if (this.wssServer) {
            this.wssServer.close();
        }

        context.sessions.forEach((session, id) => {
            if (session instanceof BaseAvSession) {
                if (session.protocol === Protocol.HTTP_FLV || session.protocol === Protocol.WS_FLV) {
                    session.stop();
                }
            }
        });

        this.logger.log(`Node Media Http Server stopped.`);
    }

}

export { NodeHttpServer };
