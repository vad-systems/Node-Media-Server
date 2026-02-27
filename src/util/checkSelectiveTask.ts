import { SelectiveTaskConfig } from '../types/config/task.js';
import asRegExp from './asRegExp.js';

const checkSelectiveTask = (config: SelectiveTaskConfig, app: string, streamPath: string) => {
    const pattern = asRegExp(config.pattern);
    return (
        app === config.app
        && (!pattern || pattern.test(streamPath))
    );
}

export default checkSelectiveTask;
