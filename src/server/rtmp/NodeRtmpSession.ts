import { Socket } from 'net';
import { context } from '@vad-systems/nms-core';
import { AVPacket, Rtmp } from '@vad-systems/nms-protocol';
import { RtmpSessionConfig, SessionState } from '@vad-systems/nms-shared';
import { BaseAvSession, Protocol } from '@vad-systems/nms-server';

class NodeRtmpSession extends BaseAvSession<never, RtmpSessionConfig> {
    public readonly socket: Socket;
    private rtmp: Rtmp;
    private pingInterval: NodeJS.Timeout | null = null;

    constructor(config: RtmpSessionConfig, socket: Socket) {
        super(config, socket.remoteAddress + ':' + socket.remotePort, Protocol.RTMP);
        this.socket = socket;
        this.rtmp = new Rtmp();
    }

    start = () => {
        super.start();
        this.rtmp.onConnectCallback = this.onConnect;
        this.rtmp.onPlayCallback = this.onPlay;
        this.rtmp.onPushCallback = this.onPush;
        this.rtmp.onOutputCallback = this.onOutput;
        this.rtmp.onPacketCallback = this.onPacket;
        this.socket.on('data', this.onData);
        this.socket.on('close', this.onClose);
        this.socket.on('error', this.onError);
        this.socket.on('timeout', this.onClose);
        this.socket.on('end', this.onClose);

        const ping = this.conf.rtmp.ping ?? 30;
        const pingTimeout = this.conf.rtmp.ping_timeout ?? 60;

        if (pingTimeout > 0) {
            this.socket.setTimeout(pingTimeout * 1000);
        }

        if (ping > 0) {
            this.pingInterval = setInterval(() => {
                this.rtmp.sendPing();
            }, ping * 1000);
        }
    };

    onConnect = (req: { app: string, name: string, host: string, query: any }) => {
        this.streamApp = req.app;
        this.streamName = req.name;
        this.streamHost = req.host;
        this.streamPath = '/' + req.app + '/' + req.name;
        this.streamQuery = req.query;
        this.logger.log(`[RTMP] connected: streamPath=${this.streamPath} remoteIp=${this.remoteIp}`);
    };

    onClose() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        if (this.state !== SessionState.STOPPED && this.state !== SessionState.STOPPING) {
            this.stop();
        }

        super.onClose();
    }

    onOutput = (buffer: Buffer) => {
        this.sendBuffer(buffer);
    };

    onData = (data: Buffer) => {
        this.inBytes += data.length;
        try {
            this.rtmp.parserData(data);
        } catch (err: any) {
            this.logger.warn(`[RTMP] parserData error: ${err} remoteIp=${this.remoteIp}`);
            this.stop();
        }
    };

    sendBuffer = (buffer: Buffer | AVPacket) => {
        if (Buffer.isBuffer(buffer)) {
            this.outBytes += buffer.length;
            this.socket.write(buffer);
        }
    };

    stop = () => {
        if (this.state === SessionState.STOPPED || this.state === SessionState.STOPPING) {
            return;
        }
        super.stop();
        this.socket.destroy();
        this.didStop();
    };
}

export { NodeRtmpSession };
