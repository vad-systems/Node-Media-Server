import Http from 'http';

export * from './core.js';
export * from './session.js';
export * from './config/index.js';

export enum NodeConnectionType {
    HTTP = 'http',
    WS = 'ws',
}

export class NodeHttpRequest {
    req: Express.Request | Http.IncomingMessage;
    remoteAddress: string;
    nmsConnectionType: NodeConnectionType;
}

export type NodeHttpResponse = {
    res: Express.Response | WebSocket;
}
