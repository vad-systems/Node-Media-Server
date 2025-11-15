import { FfmpegSessionConfig } from '../session.js';
import { SelectiveTaskConfig, TaskConfig } from './task.js';

export enum RelayMode {
    PUSH = 'push',
    PULL = 'pull',
}

export enum RtspTransport {
    UDP = 'udp',
    TCP = 'tcp',
    UDP_MULTICAST = 'udp_multicast',
    HTTP = 'http',
}

type RelayTaskConfig = {
    readonly mode: RelayMode;
    readonly edge: string;
    readonly rescale?: string;
    readonly rtsp_transport?: RtspTransport;
    readonly appendName?: boolean;
}

export type RelayPullTaskConfig = RelayTaskConfig & TaskConfig & {
    readonly mode: RelayMode.PULL;
}

export type RelayPushTaskConfig = RelayTaskConfig & SelectiveTaskConfig & {
    readonly mode: RelayMode.PUSH;
}

export type RelayConfig = {
    readonly ffmpeg: string;
    readonly tasks: (RelayPushTaskConfig | RelayPullTaskConfig)[];
}

export type RelaySessionConfig = (RelayPushTaskConfig | RelayPullTaskConfig) & FfmpegSessionConfig<never> & {
    inPath: string;
    ouPath: string;
}
