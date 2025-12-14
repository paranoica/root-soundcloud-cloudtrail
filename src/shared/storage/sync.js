class StorageSync {
    constructor() {
        this._cache = new Map();

        this._pendingWrites = new Map();
        this._writeTimeout = null;

        this._listeners = new Map();
        this._writeDelay = 1000;

        chrome.storage.onChanged.addListener(this._handleStorageChange.bind(this));
    }

    _handleStorageChange(changes, areaName) {
        if (areaName !== "local")
            return;

        for (const [key, { newValue }] of Object.entries(changes)) {
            if (newValue !== undefined) {
                this._cache.set(key, newValue);
            } else {
                this._cache.delete(key);
            }

            const listeners = this._listeners.get(key) || []; listeners.forEach(callback => {
                try {
                    callback(newValue, key);
                } catch (error) {
                    console.error("[Storage] Listener error:", error);
                }
            });
        }
    }

    async get(key, defaultValue = null) {
        if (this._cache.has(key)) {
            return this._cache.get(key);
        }

        if (this._pendingWrites.has(key)) {
            return this._pendingWrites.get(key);
        }

        try {
            const result = await chrome.storage.local.get(key);
            const value = result[key] !== undefined ? result[key] : defaultValue;

            this._cache.set(key, value);

            return value;
        } catch (error) {
            console.error("[Storage] Get error:", error);
            return defaultValue;
        }
    }

    async getMultiple(keys) {
        const result = {};
        const uncachedKeys = [];

        for (const key of keys) {
            if (this._cache.has(key)) {
                result[key] = this._cache.get(key);
            } else if (this._pendingWrites.has(key)) {
                result[key] = this._pendingWrites.get(key);
            } else {
                uncachedKeys.push(key);
            }
        }

        if (uncachedKeys.length > 0) {
            try {
                const stored = await chrome.storage.local.get(uncachedKeys);
                for (const key of uncachedKeys) {
                    const value = stored[key] !== undefined ? stored[key] : null;
                    result[key] = value;
                    this._cache.set(key, value);
                }
            } catch (error) {
                console.error("[Storage] GetMultiple error:", error);
            }
        }

        return result;
    }

    async set(key, value, immediate = false) {
        this._cache.set(key, value);

        if (immediate) {
            try {
                await chrome.storage.local.set({ [key]: value });
            } catch (error) {
                console.error("[Storage] Set error:", error);
                throw error;
            }
        } else {
            this._pendingWrites.set(key, value);
            this._scheduleWrite();
        }
    }
    
    async setMultiple(items, immediate = false) {
        for (const [key, value] of Object.entries(items)) {
            this._cache.set(key, value);
        }

        if (immediate) {
            try {
                await chrome.storage.local.set(items);
            } catch (error) {
                console.error("[Storage] SetMultiple error:", error);
                throw error;
            }
        } else {
            for (const [key, value] of Object.entries(items)) {
                this._pendingWrites.set(key, value);
            }

            this._scheduleWrite();
        }
    }

    async remove(key) {
        this._cache.delete(key);
        this._pendingWrites.delete(key);

        try {
            await chrome.storage.local.remove(key);
        } catch (error) {
            console.error("[Storage] Remove error:", error);
        }
    }

    _scheduleWrite() {
        if (this._writeTimeout)
            return;

        this._writeTimeout = setTimeout(async () => {
            await this._flushWrites();
            this._writeTimeout = null;
        }, this._writeDelay);
    }

    async _flushWrites() {
        if (this._pendingWrites.size === 0)
            return;

        const writes = Object.fromEntries(this._pendingWrites);
        this._pendingWrites.clear();

        try {
            await chrome.storage.local.set(writes);
        } catch (error) {
            console.error("[Storage] Flush error:", error);

            for (const [key, value] of Object.entries(writes)) {
                this._pendingWrites.set(key, value);
            }

            this._scheduleWrite();
        }
    }

    async flush() {
        if (this._writeTimeout) {
            clearTimeout(this._writeTimeout);
            this._writeTimeout = null;
        }

        await this._flushWrites();
    }

    subscribe(key, callback) {
        if (!this._listeners.has(key)) {
            this._listeners.set(key, []);
        }

        this._listeners.get(key).push(callback);

        return () => {
            const listeners = this._listeners.get(key);
            if (listeners) {
                const index = listeners.indexOf(callback);
                if (index > -1) {
                    listeners.splice(index, 1);
                }
            }
        };
    }

    clearCache() {
        this._cache.clear();
    }

    async getUsage() {
        try {
            const bytesInUse = await chrome.storage.local.getBytesInUse(null);
            const quota = chrome.storage.local.QUOTA_BYTES || 10485760; // 10MB default

            return {
                used: bytesInUse,
                total: quota,
                percentage: Math.round((bytesInUse / quota) * 100),
                available: quota - bytesInUse,
            };
        } catch (error) {
            console.error("[Storage] Usage check error:", error);
            return null;
        }
    }
}

export const storageSync = new StorageSync();
export default storageSync;