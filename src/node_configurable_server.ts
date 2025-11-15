import { context } from './core/index.js';
import { Config } from './types/index.js';

abstract class NodeConfigurableServer {
    private running: boolean;
    protected config: Config;

    protected constructor() {
        this.config = context.configProvider.getConfig();

        this.onConfigChanged = this.onConfigChanged.bind(this);
        context.nodeEvent.on('configChanged', this.onConfigChanged);
    }

    private async onConfigChanged() {
        this.config = context.configProvider.getConfig();

        if (this.running) {
            this.stop();
            await this.run();
        }
    }

    async run() {
        this.running = true;
    }

    public stop() {
        this.running = false;
    }
}

export default NodeConfigurableServer;
