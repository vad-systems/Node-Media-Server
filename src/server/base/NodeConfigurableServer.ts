import { context } from '@vad-systems/nms-core';
import { Config } from '@vad-systems/nms-shared';

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

    public async run() {
        this.running = true;
    }

    public stop() {
        this.running = false;
    }
}

export { NodeConfigurableServer };
