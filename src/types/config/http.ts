import { PathLike } from 'fs';
import { SessionConfig } from '../session.js';
import { AuthConfig } from './index.js';

export type HttpSessionConfig = SessionConfig<never> & {
    readonly auth?: AuthConfig;
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
