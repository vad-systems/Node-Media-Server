import { SessionConfig } from '../session.js';
import { Arguments } from '../index.js';

export type SwitchTaskConfig = {
    readonly app: string;
    readonly name: string;
    readonly sources: string[];
    readonly defaultSource?: string;
    readonly switchTimeout?: number;
    readonly slatePath?: string;
    readonly args?: Arguments;
}

export type SwitchConfig = {
    readonly tasks: SwitchTaskConfig[];
}

export type SwitchSessionConfig = SwitchTaskConfig & SessionConfig<any> & {
    readonly streamPath: string;
}
