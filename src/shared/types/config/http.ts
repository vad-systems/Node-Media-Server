import { PathLike } from 'fs';

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
