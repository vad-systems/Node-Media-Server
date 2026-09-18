import { PathLike } from 'fs';
import { FfmpegSessionConfig } from '../session.js';
import { SelectiveTaskConfig } from './task.js';

export type FissionModelConfig = {
    readonly vb: string;
    readonly vf: string;
    readonly vs: string;
    readonly ab: string;
    readonly vc?: string;
    readonly vcParam?: string[];
}

export type FissionTaskConfig = SelectiveTaskConfig & {
    readonly model: FissionModelConfig[];
    readonly vc?: string;
    readonly vcParam?: string[];
    readonly vaapi_device?: string;
    readonly vaapiDevice?: string;
}

export type FissionConfig = {
    readonly ffmpeg: string;
    readonly tasks: FissionTaskConfig[];
    readonly vaapi_device?: string;
    readonly vaapiDevice?: string;
}

export type FissionSessionConfig = FissionTaskConfig & FfmpegSessionConfig<object> & {
    readonly mediaroot: PathLike;
    readonly rtmpPort: number;
    readonly streamPath: string;
    readonly streamApp: string;
    readonly streamName: string;
}
