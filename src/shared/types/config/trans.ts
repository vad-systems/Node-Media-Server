import { PathLike } from 'fs';
import { FfmpegSessionConfig } from '../session.js';
import { SelectiveTaskConfig } from './task.js';

export type TransTaskConfig = SelectiveTaskConfig & {
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
    readonly vaapi_device?: string;
    readonly vaapiDevice?: string;
}

export type TransConfig = {
    readonly ffmpeg: string;
    readonly tasks: TransTaskConfig[];
    readonly vaapi_device?: string;
    readonly vaapiDevice?: string;
}

export type TransSessionConfig = TransTaskConfig & FfmpegSessionConfig<object> & {
    readonly mediaroot: PathLike;
    readonly rtmpPort: number;
    readonly streamPath: string;
    readonly streamApp: string;
    readonly streamName: string;
}
