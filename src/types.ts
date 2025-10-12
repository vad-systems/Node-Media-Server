import { PathLike } from 'fs';
import Http from 'http';

export enum LogType {
    NONE = 0,
    ERROR = 1,
    NORMAL = 2,
    DEBUG = 3,
    FFDEBUG = 4,
}

export enum RtspTransport {
    UDP = 'udp',
    TCP = 'tcp',
    UDP_MULTICAST = 'udp_multicast',
    HTTP = 'http',
}

export enum Mode {
    PUSH = 'push',
    PULL = 'pull',
}

export enum NodeConnectionType {
    HTTP = 'http',
    WS = 'ws',
}

export type SessionID = string;

export type Arguments = {
    [key: string]: any
}

export type NodeEventMap = {
    preConnect: [SessionID, any],
    postConnect: [SessionID, any],
    prePlay: [SessionID, string, Arguments],
    postPlay: [SessionID, string, Arguments],
    donePlay: [SessionID, string, Arguments],
    doneConnect: [SessionID, any],
    prePublish: [SessionID, string, Arguments],
    postPublish: [SessionID, string, Arguments],
    donePublish: [SessionID, string, Arguments],
    logMessage: any[],
    errorMessage: any[],
    debugMessage: any[],
    ffDebugMessage: any[],
};

export class NodeHttpRequest {
    req: Express.Request | Http.IncomingMessage;
    remoteAddress: string;
    nmsConnectionType: NodeConnectionType;
}

export type NodeHttpResponse = {
    res: Express.Response | WebSocket;
}

export type SessionConfig<A extends Arguments> = {
    args?: A;
}

export type FfmpegSessionConfig<A> = SessionConfig<A> & {
    readonly ffmpeg: string;
}

export type RelaySessionConfig = RelayTaskConfig & FfmpegSessionConfig<never> & {
    inPath: string;
    ouPath: string;
}

export type TransSessionConfig = TransTaskConfig & FfmpegSessionConfig<object> & {
    readonly mediaroot: PathLike;
    readonly rtmpPort: number;
    readonly streamPath: string;
    readonly streamApp: string;
    readonly streamName: string;
}

export type FissionSessionConfig = FissionTaskConfig & FfmpegSessionConfig<object> & {
    readonly mediaroot: PathLike;
    readonly rtmpPort: number;
    readonly streamPath: string;
    readonly streamApp: string;
    readonly streamName: string;
}

export type HttpSessionConfig = SessionConfig<never> & {
    readonly auth?: AuthConfig;
}

export type RtmpSessionConfig = SessionConfig<never> & {
    readonly auth?: AuthConfig;
    readonly rtmp: RtmpConfig;
}

export type RtmpSslConfig = {
    readonly port?: number;
    readonly key: PathLike;
    readonly cert: PathLike;
}

export type RtmpConfig = {
    readonly port?: number;
    readonly ssl?: RtmpSslConfig;
    readonly chunk_size?: number;
    readonly ping?: number;
    readonly ping_timeout?: number;
    readonly gop_cache?: boolean;
}

export type HttpConfig = {
    readonly mediaroot?: PathLike;
    readonly port?: number;
    readonly allow_origin?: string;
    readonly api?: boolean;
    readonly webroot?: string;
}

export type HttpsConfig = {
    readonly port?: number;
    readonly key: PathLike;
    readonly cert: PathLike;
    readonly passphrase?: string;
}

export type TransTaskConfig = {
    readonly app: string;
    readonly rtmp?: boolean;
    readonly rtmpApp?: string;
    readonly mp4?: boolean;
    readonly mp4Flags?: string;
    readonly hls?: boolean;
    readonly hlsFlags?: string;
    readonly hlsKeep?: boolean;
    readonly dash?: boolean;
    readonly dashFlags?: string;
    readonly dashKeep?: boolean;

    readonly vc?: string;
    readonly vcParam?: string[];
    readonly ac?: string;
    readonly acParam?: string[];
}

export type TransConfig = {
    readonly ffmpeg: string;
    readonly tasks: TransTaskConfig[];
}

export type RelayTaskConfig = {
    readonly mode: Mode;
    readonly edge: NodeJS.Dict<string> | string;
    readonly app: string;
    readonly rescale?: string;
    readonly rtsp_transport?: RtspTransport;
    readonly appendName?: boolean;
    readonly pattern?: string;
}

export type RelayConfig = {
    readonly ffmpeg: string;
    readonly tasks: RelayTaskConfig[];
}

export type FissionModelConfig = {
    readonly vb: string;
    readonly vf: string;
    readonly vs: string;
    readonly ab: string;
}

export type FissionTaskConfig = {
    readonly rule: string;
    readonly model: FissionModelConfig[];
}

export type FissionConfig = {
    readonly ffmpeg: string;
    readonly tasks: FissionTaskConfig[];
}

export type ClusterConfig = {}

export type AuthConfig = {
    readonly api?: boolean;
    readonly api_user?: string;
    readonly api_pass?: string;
    readonly play?: boolean;
    readonly publish?: boolean;
    readonly secret?: string;
}

export type Config = {
    readonly http?: HttpConfig;
    readonly https?: HttpsConfig;
    readonly rtmp?: RtmpConfig;
    readonly trans?: TransConfig;
    readonly relay?: RelayConfig;
    readonly fission?: FissionConfig;

    readonly cluster?: ClusterConfig;
    readonly auth?: AuthConfig;

    readonly logType?: LogType;
}
