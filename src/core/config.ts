import { PathLike, readFileSync } from 'fs';
import { writeFileSync } from 'node:fs';
import { Config } from '../types/index.js';
import context from '../core/context.js';

class ConfigProvider {
    private configLocation: PathLike = undefined;
    private config: Config = undefined;

    constructor() {}

    public getConfig(): Config {
        if (!this.isLoaded()) {
            throw new Error('No config provided');
        }

        return this.config;
    }

    public isLoaded() {
        return typeof this.config !== typeof undefined;
    }

    public setConfigLocation(configLocation: PathLike) {
        this.configLocation = configLocation;
    }

    public setConfig(config: Config) {
        this.config = config;
        context.nodeEvent.emit('configChanged');
    }

    public loadConfig() {
        if (typeof this.configLocation === typeof undefined) {
            throw new Error('Cannot load config: Config location is not set');
        }
        const config = readFileSync(this.configLocation, 'utf-8');
        this.config = JSON.parse(config);
        context.nodeEvent.emit('configChanged');
    }

    public saveConfig() {
        if (typeof this.configLocation === typeof undefined) {
            throw new Error('Cannot save config: Config location is not set');
        }
        if (typeof this.config === typeof undefined) {
            throw new Error('Cannot save config: Config is not set');
        }
        writeFileSync(
            this.configLocation,
            JSON.stringify(this.config, undefined, 4)
        );
    }
}

export default ConfigProvider;
