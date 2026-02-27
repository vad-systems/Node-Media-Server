import { NextFunction, Request, Response } from 'express';
import _ from 'lodash';
import { FlvAudioCodec, FlvVideoCodec } from '@vad-systems/nms-protocol';
import { Context } from '@vad-systems/nms-shared';

function getStreams(this: Context, req: Request, res: Response, next: NextFunction) {
    let stats: any = {};

    this.broadcasts.forEach((broadcast, key) => {
        const [k, app, name] = key.split('/');
        const publisher = broadcast.publisher as any;
        _.setWith(stats, [app, name], {
            key,
            app,
            name,
            publisher: publisher ? {
                app,
                stream: name,
                clientId: publisher.id,
                ip: publisher.remoteIp,
                protocol: publisher.protocol === 'websocket-flv' ? 'ws' : (
                    publisher.protocol === 'http-flv' ? 'http' : publisher.protocol
                ),
                connectCreated: publisher.startTime,
                video: publisher.videoCodec !== null ? {
                    codec: FlvVideoCodec[publisher.videoCodec],
                    width: publisher.videoWidth,
                    height: publisher.videoHeight,
                    profile: publisher.videoProfile,
                    level: publisher.videoLevel,
                    fps: publisher.videoFramerate,
                } : null,
                audio: publisher.audioCodec !== null ? {
                    codec: FlvAudioCodec[publisher.audioCodec],
                    profile: publisher.audioProfile,
                    channels: publisher.audioChannels,
                    samplerate: publisher.audioSamplerate,
                } : null,
                bytes: publisher.inBytes,
            } : null,
            subscribers: [...broadcast.subscribers.values()].map(
                subscriber => {
                    switch (subscriber.TAG) {
                        case 'rtmp': {
                            return {
                                app,
                                stream: name,
                                clientId: subscriber.id,
                                connectCreated: subscriber.startTime,
                                bytes: subscriber.outBytes,
                                ip: subscriber.remoteIp,
                                protocol: 'rtmp',
                            };
                        }
                        case 'http-flv':
                        case 'websocket-flv': {
                            return {
                                app,
                                stream: name,
                                clientId: subscriber.id,
                                connectCreated: subscriber.startTime,
                                bytes: subscriber.outBytes,
                                ip: subscriber.remoteIp,
                                protocol: subscriber.TAG === 'websocket-flv' ? 'ws' : 'http',
                            };
                        }
                        case 'relay':
                        case 'trans':
                        case 'fission': {
                            return {
                                app,
                                stream: name,
                                clientId: subscriber.id,
                                connectCreated: subscriber.startTime,
                                bytes: subscriber.outBytes,
                                ip: subscriber.remoteIp,
                                protocol: subscriber.TAG,
                            };
                        }
                    }
                    return null;
                },
            ).filter(Boolean),
        });
    });

    res.json(stats);
}

function getStream(this: Context, req: Request, res: Response, next: NextFunction) {
    let streamStats: any = {
        isLive: false,
        viewers: 0,
        duration: 0,
        bitrate: 0,
        startTime: null,
        arguments: {},
    };

    let publishStreamPath = `/${req.params.app}/${req.params.stream}`;
    let broadcast = this.broadcasts.get(publishStreamPath);

    let publisherSession: any = this.sessions.get(
        broadcast?.publisher?.id,
    );

    streamStats.isLive = !!publisherSession;
    streamStats.viewers = broadcast?.subscribers?.size || 0;
    streamStats.duration = streamStats.isLive
        ? Math.ceil((
            Date.now() - publisherSession.startTime
        ) / 1000)
        : 0;
    streamStats.bitrate = 0;
    streamStats.startTime = streamStats.isLive
        ? publisherSession.startTime
        : null;
    streamStats.arguments = !!publisherSession ? publisherSession.streamQuery : {};

    res.json(streamStats);
}

function delStream(this: Context, req: Request, res: Response, next: NextFunction) {
    let publishStreamPath = `/${req.params.app}/${req.params.stream}`;
    let publisherSession = this.sessions.get(
        this.broadcasts.get(publishStreamPath)?.publisher?.id,
    );

    if (publisherSession) {
        publisherSession.stop();
        res.json('ok');
    } else {
        res.status(404).json({ error: 'stream not found' });
    }
}

export default {
    delStream,
    getStreams,
    getStream,
};
