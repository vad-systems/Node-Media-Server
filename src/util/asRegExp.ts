const asRegExp = (pattern: string | RegExp | undefined) => {
    if (pattern instanceof RegExp) {
        return pattern;
    }

    if (typeof pattern === typeof undefined) {
        return undefined;
    }

    return new RegExp(pattern, 'g');
}

export default asRegExp;
