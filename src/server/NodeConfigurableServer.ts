import { context } from '../core/index.js';
import { Config } from '../types/index.js';

abstract class NodeConfigurableServer {
    private running: boolean;
    protected config: Config;

    protected constructor() {
        this.config = context.configProvider.getConfig();

        this.onConfigChanged = this.onConfigChanged.bind(this);
        context.nodeEvent.on('configChanged', this.onConfigChanged);
    }

    private async onConfigChanged() {
        const newConfig = context.configProvider.getConfig();

        if (this.running && this.needsRestart(newConfig)) {
            this.stop();
            this.config = newConfig;
            await this.run();
        } else {
            this.config = newConfig;
        }
    }

    protected needsRestart(newConfig: Config) {
        return true;
    }

    public isRunning() {
        return this.running;
    }

    async run() {
        this.running = true;
    }

    public stop() {
        this.running = false;
    }
}

export default NodeConfigurableServer;
