import { FfmpegSessionConfig } from '../session.js';
import { TaskConfig } from './task.js';

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

export type RelayTaskConfig = TaskConfig & {
    readonly mode: RelayMode;
    readonly edge: string;
    readonly rescale?: string;
    readonly rtsp_transport?: RtspTransport;
    readonly appendName?: boolean;
}

export type RelayConfig = {
    readonly ffmpeg: string;
    readonly tasks: RelayTaskConfig[];
}

export type RelaySessionConfig = RelayTaskConfig & FfmpegSessionConfig<never> & {
    inPath: string;
    ouPath: string;
}
