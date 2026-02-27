import { SelectiveTaskConfig } from '@vad-systems/nms-shared';
import asRegExp from './asRegExp.js';

const checkSelectiveTask = (config: SelectiveTaskConfig, app: string, streamPath: string) => {
    const pattern = asRegExp(config.pattern);

    return (
        app === config.app
        && (
            !pattern || pattern.test(streamPath)
        )
    );
};

export { checkSelectiveTask };
