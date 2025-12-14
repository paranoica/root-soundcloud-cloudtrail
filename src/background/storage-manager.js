import { STORAGE_KEYS } from "../shared/constants.js";
import { getDateString, getHour } from "../shared/utils/time.js";

class StorageManager {
    constructor() {
        this._cache = {
            tracks: {},
            daily: {},
            trackInfo: {}
        };
        this._dirty = {
            tracks: false,
            daily: false,
            trackInfo: false
        };
        this._saveTimeout = null;
        this._initialized = false;
    }

    async init() {
        if (this._initialized)
            return;

        try {
            const data = await chrome.storage.local.get([
                STORAGE_KEYS.TRACKS,
                STORAGE_KEYS.DAILY_STATS,
                STORAGE_KEYS.TRACK_CACHE
            ]);

            this._cache.tracks = data[STORAGE_KEYS.TRACKS] || {};
            this._cache.daily = data[STORAGE_KEYS.DAILY_STATS] || {};
            this._cache.trackInfo = data[STORAGE_KEYS.TRACK_CACHE] || {};

            this._initialized = true;
        } catch (error) {
            console.error("[StorageManager] Init error:", error);
        }
    }

    async saveTrackInfo(track) {
        if (!track || !track.id)
            return;

        const id = String(track.id);
        this._cache.trackInfo[id] = {
            ...track,
            cachedAt: Date.now(),
        };

        const keys = Object.keys(this._cache.trackInfo);
        if (keys.length > 1000) {
            delete this._cache.trackInfo[keys[0]];
        }

        this._dirty.trackInfo = true;
        this._scheduleFlush();
    }

    async getTrackInfo(trackId) {
        return this._cache.trackInfo[String(trackId)] || null;
    }

    getTrackStats(trackId) {
        const id = String(trackId);
        if (!this._cache.tracks[id]) {
            this._cache.tracks[id] = {
                trackId: id,
                playCount: 0,
                totalSeconds: 0,
                lastPlayedAt: 0,
                dailySeconds: {}
            };
        }

        return this._cache.tracks[id];
    }

    async addListeningTime(trackId, seconds) {
        if (seconds <= 0)
            return;

        const id = String(trackId);

        const stats = this.getTrackStats(id);
        const today = getDateString();

        stats.totalSeconds = (stats.totalSeconds || 0) + seconds;
        stats.lastPlayedAt = Date.now();

        if (!stats.dailySeconds)
            stats.dailySeconds = {};

        stats.dailySeconds[today] = (stats.dailySeconds[today] || 0) + seconds;
        this._updateDailyGlobalStats(seconds);

        this._dirty.tracks = true;
        this._scheduleFlush();
    }

    async incrementPlayCount(trackId) {
        const id = String(trackId);
        const stats = this.getTrackStats(id);

        stats.playCount = (stats.playCount || 0) + 1;
        stats.lastPlayedAt = Date.now();

        this._dirty.tracks = true;
        this._scheduleFlush();
    }

    _updateDailyGlobalStats(seconds) {
        const today = getDateString();
        const hour = getHour(Date.now());

        if (!this._cache.daily[today]) {
            this._cache.daily[today] = {
                totalSeconds: 0,
                hourlySeconds: {},
                sessionsCount: 0,
                tracksPlayedSet: []
            };
        }

        const dayStats = this._cache.daily[today]; dayStats.totalSeconds += seconds;
        if (!dayStats.hourlySeconds)
            dayStats.hourlySeconds = {};
        dayStats.hourlySeconds[hour] = (dayStats.hourlySeconds[hour] || 0) + seconds;

        this._dirty.daily = true;
    }

    async recordSession(trackId, seconds, completed = false) {
        if (seconds < 5)
            return;

        const today = getDateString();
        if (!this._cache.daily[today])
            this._updateDailyGlobalStats(0);

        this._cache.daily[today].sessionsCount++;
        this._dirty.daily = true;

        this._scheduleFlush();
    }

    _scheduleFlush() {
        if (this._saveTimeout)
            return;

        this._saveTimeout = setTimeout(() => this.flush(), 5000);
    }

    async flush() {
        if (this._saveTimeout) {
            clearTimeout(this._saveTimeout);
            this._saveTimeout = null;
        }

        const promises = [];

        if (this._dirty.tracks) {
            promises.push(chrome.storage.local.set({ [STORAGE_KEYS.TRACKS]: this._cache.tracks }));
            this._dirty.tracks = false;
        }

        if (this._dirty.daily) {
            promises.push(chrome.storage.local.set({ [STORAGE_KEYS.DAILY_STATS]: this._cache.daily }));
            this._dirty.daily = false;
        }

        if (this._dirty.trackInfo) {
            promises.push(chrome.storage.local.set({ [STORAGE_KEYS.TRACK_CACHE]: this._cache.trackInfo }));
            this._dirty.trackInfo = false;
        }

        if (promises.length > 0) {
            await Promise.all(promises);
        }
    }

    async getTopTracks(options = {}) {
        const { sortBy = "playCount", limit = 10, period = "all" } = options;

        let items = Object.values(this._cache.tracks); items.sort((a, b) => {
            const valA = a[sortBy] || 0;
            const valB = b[sortBy] || 0;

            return valB - valA;
        });

        const result = items.slice(0, limit);
        return result.map(stats => ({
            ...stats,
            track: this._cache.trackInfo[stats.trackId] || null
        }));
    }

    async getTotalStats(period = "all") {
        let totalSeconds = 0;
        let totalPlays = 0;
        let totalTracks = 0;

        const tracks = Object.values(this._cache.tracks); totalTracks = tracks.length; tracks.forEach(t => {
            totalSeconds += t.totalSeconds || 0;
            totalPlays += t.playCount || 0;
        });

        return { totalSeconds, totalPlays, totalTracks };
    }

    getDailyStatsForPeriod() {
        return Object.entries(this._cache.daily).map(([date, stats]) => ({
            date,
            ...stats
        })).sort((a, b) => new Date(a.date) - new Date(b.date));
    }
}

export const storageManager = new StorageManager();
export default storageManager;