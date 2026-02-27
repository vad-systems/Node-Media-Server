import _ from 'lodash';

abstract class NodeConfigurableServer<C> {
    config: C;

    protected constructor(config: C) {
        this.config = _.cloneDeep(config);
    }

    async updateConfig(config: C) {
        this.stop();
        this.config = _.cloneDeep(config);
        await this.run();
    }

    abstract run(): Promise<void>;

    abstract stop(): void;
}

export default NodeConfigurableServer;
