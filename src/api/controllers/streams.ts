import { NextFunction, Request, Response } from 'express';
import _ from 'lodash';
import { FlvAudioCodec, FlvVideoCodec } from '../../core/protocol/flv.js';
import { Context } from '../../types/index.js';

function getStreams(this: Context, req: Request, res: Response, next: NextFunction) {
    let stats: any = {};

    this.broadcasts.forEach((broadcast, key) => {
        const [k, app, name] = key.split('/');
        _.setWith(stats, [app, name], {
            key,
            app,
            name,
            publisher: broadcast.publisher ? {
                app,
                strean: name,
                clientId: broadcast.publisher.id,
                ip: broadcast.publisher.remoteIp,
                protocol: broadcast.publisher.protocol,
                connectCreated: broadcast.publisher.startTime,
                video: broadcast.publisher.videoCodec > 0 ? {
                    codec: FlvVideoCodec[broadcast.publisher.videoCodec],
                    width: broadcast.publisher.videoWidth,
                    height: broadcast.publisher.videoHeight,
                    profile: broadcast.publisher.videoProfile,
                    level: broadcast.publisher.level,
                    fps: broadcast.publisher.videoFramerate,
                } : null,
                audio: broadcast.publisher.audioCodec > 0 ? {
                    codec: FlvAudioCodec[broadcast.publisher.audioCodec],
                    profile: broadcast.publisher.audioProfile,
                    channels: broadcast.publisher.audioChannels,
                    samplerate: broadcast.publisher.audioSamplerate,
                } : null,
                bytes: broadcast.publisher.inBytes,
            } : null,
            subscribers: [...broadcast.subscribers.values()].map(
                subscriber => {
                    switch (subscriber.constructor.name) {
                        case 'NodeRtmpSession': {
                            return {
                                app,
                                stream: name,
                                clientId: subscriber.id,
                                connectCreated: subscriber.connectTime,
                                bytes: subscriber.socket.bytesWritten,
                                ip: subscriber.remoteIp,
                                protocol: 'rtmp',
                            };
                        }
                        case 'NodeHttpSession': {
                            return {
                                app,
                                stream: name,
                                clientId: subscriber.id,
                                connectCreated: subscriber.connectTime,
                                bytes: subscriber.req.connection.bytesWritten,
                                ip: subscriber.remoteIp,
                                protocol: subscriber.TAG === 'websocket-flv' ? 'ws' : 'http',
                            };
                        }
                    }
                    return null;
                }
            ).filter(Boolean)
        });
    });

    this.sessions.forEach(function (session: any, id) {
        if (session.isStarting) {
            let regRes = /\/(.*)\/(.*)/gi.exec(
                session.publishStreamPath || session.playStreamPath,
            );

            if (regRes === null) {
                return;
            }

            let [app, stream] = _.slice(regRes, 1);

            if (!_.get(stats, [app, stream])) {
                _.setWith(stats, [app, stream], {
                    publisher: null,
                    subscribers: [],
                }, Object);
            }

            switch (true) {
                case session.isPublishing: {
                    _.setWith(stats, [app, stream, 'publisher'], {
                        app: app,
                        stream: stream,
                        clientId: session.id,
                        connectCreated: session.connectTime,
                        bytes: session.socket.bytesRead,
                        ip: session.socket.remoteAddress,
                        audio: session.audioCodec > 0 ? {
                            codec: session.audioCodecName,
                            profile: session.audioProfileName,
                            samplerate: session.audioSamplerate,
                            channels: session.audioChannels,
                        } : null,
                        video: session.videoCodec > 0 ? {
                            codec: session.videoCodecName,
                            width: session.videoWidth,
                            height: session.videoHeight,
                            profile: session.videoProfileName,
                            level: session.videoLevel,
                            fps: session.videoFps,
                        } : null,
                    }, Object);
                    break;
                }
                case !!session.playStreamPath: {
                    switch (session.constructor.name) {
                        case 'NodeRtmpSession': {
                            stats[app][stream]['subscribers'].push({
                                app: app,
                                stream: stream,
                                clientId: session.id,
                                connectCreated: session.connectTime,
                                bytes: session.socket.bytesWritten,
                                ip: session.socket.remoteAddress,
                                protocol: 'rtmp',
                            });

                            break;
                        }
                        case 'NodeHttpSession': {
                            stats[app][stream]['subscribers'].push({
                                app: app,
                                stream: stream,
                                clientId: session.id,
                                connectCreated: session.connectTime,
                                bytes: session.req.connection.bytesWritten,
                                ip: session.req.connection.remoteAddress,
                                protocol: session.TAG === 'websocket-flv' ? 'ws' : 'http',
                            });

                            break;
                        }
                    }

                    break;
                }
            }
        }
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

    let publisherSession: any = this.sessions.get(
        this.publishers.get(publishStreamPath),
    );

    streamStats.isLive = !!publisherSession;
    streamStats.viewers = _.filter(
        Array.from(this.sessions.values()),
        (session: any) => {
            return session.playStreamPath === publishStreamPath;
        },
    ).length;
    streamStats.duration = streamStats.isLive
        ? Math.ceil((
            Date.now() - publisherSession.startTimestamp
        ) / 1000)
        : 0;
    streamStats.bitrate =
        streamStats.duration > 0 ? publisherSession.bitrate : 0;
    streamStats.startTime = streamStats.isLive
        ? publisherSession.connectTime
        : null;
    streamStats.arguments = !!publisherSession ? publisherSession.publishArgs : {};

    res.json(streamStats);
}

function delStream(this: Context, req: Request, res: Response, next: NextFunction) {
    let publishStreamPath = `/${req.params.app}/${req.params.stream}`;
    let publisherSession = this.sessions.get(
        this.publishers.get(publishStreamPath),
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
