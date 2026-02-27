import { SessionConfig } from '../session.js';
import { AuthConfig } from './index.js';

export type AvSessionConfig = SessionConfig<never> & {
    readonly auth?: AuthConfig;
}

export type AvConfig = {
    // maybe some configs here later
}
