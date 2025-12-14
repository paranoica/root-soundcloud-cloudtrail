export function debounce(func, wait, immediate = false) {
    let timeout;

    return function executedFunction(...args) {
        const context = this;
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };

        const callNow = immediate && !timeout;

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);

        if (callNow) func.apply(context, args);
    };
}

export function throttle(func, wait) {
    let timeout;
    let lastCall = 0;

    return function executedFunction(...args) {
        const context = this;

        const now = Date.now();
        const remaining = wait - (now - lastCall);

        if (remaining <= 0 || remaining > wait) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }

            lastCall = now;
            func.apply(context, args);
        } else if (!timeout) {
            timeout = setTimeout(() => {
                lastCall = Date.now();
                timeout = null;
                func.apply(context, args);
            }, remaining);
        }
    };
}

export function memoize(func, resolver) {
    const cache = new Map();

    const memoized = function (...args) {
        const key = resolver ? resolver.apply(this, args) : args[0];

        if (cache.has(key)) {
            return cache.get(key);
        }

        const result = func.apply(this, args); cache.set(key, result);
        return result;
    };

    memoized.cache = cache;
    memoized.clear = () => cache.clear();

    return memoized;
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retry(fn, maxRetries = 3, delay = 1000) {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries - 1) {
                await sleep(delay * Math.pow(2, attempt));
            }
        }
    }

    throw lastError;
}

export function generateId() {
    return crypto.randomUUID ?
        crypto.randomUUID() :
        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === "x" ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
}

export function deepClone(obj) {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }

    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item));
    }

    const cloned = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }

    return cloned;
}

export function deepMerge(target, ...sources) {
    if (!sources.length)
        return target;

    const source = sources.shift();
    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                deepMerge(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }

    return deepMerge(target, ...sources);
}

function isObject(item) {
    return item && typeof item === "object" && !Array.isArray(item);
}

export function chunk(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

export function groupBy(array, key) {
    return array.reduce((result, item) => {
        const groupKey = typeof key === "function" ? key(item) : item[key];
        (result[groupKey] = result[groupKey] || []).push(item);
        return result;
    }, {});
}