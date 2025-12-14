import { STORAGE_KEYS } from "../shared/constants.js";
import {
    createTrackStats,
    createSession,
    createDailyStats,
} from "../shared/storage/schema.js";
import { getDateString, getHour } from "../shared/utils/time.js";
import storageSync from "../shared/storage/sync.js";

class StorageManager {
    constructor() {
        this._trackStatsCache = new Map();
        this._dailyStatsCache = new Map();
        this._initialized = false;
    }

    async init() {
        if (this._initialized)
            return;

        try {
            const trackStats = await storageSync.get(STORAGE_KEYS.TRACKS, {});
            for (const [trackId, stats] of Object.entries(trackStats)) {
                this._trackStatsCache.set(trackId, stats);
            }

            const dailyStats = await storageSync.get(STORAGE_KEYS.DAILY_STATS, {});
            for (const [date, stats] of Object.entries(dailyStats)) {
                this._dailyStatsCache.set(date, stats);
            }

            this._initialized = true;
        } catch (error) {
            console.error("[StorageManager] Init error:", error);
        }
    }

    async getTrackInfo(trackId) {
        const cache = await storageSync.get(STORAGE_KEYS.TRACK_CACHE, {});
        return cache[trackId] || null;
    }

    async saveTrackInfo(track) {
        if (!track || !track.id)
            return;

        const cache = await storageSync.get(STORAGE_KEYS.TRACK_CACHE, {}); cache[track.id] = {
            ...track,
            cachedAt: Date.now(),
        };

        const entries = Object.entries(cache);
        if (entries.length > 500) {
            entries.sort((a, b) => (b[1].cachedAt || 0) - (a[1].cachedAt || 0));

            const toKeep = entries.slice(0, 500);
            const newCache = Object.fromEntries(toKeep);

            await storageSync.set(STORAGE_KEYS.TRACK_CACHE, newCache);
        } else {
            await storageSync.set(STORAGE_KEYS.TRACK_CACHE, cache);
        }
    }

    getTrackStats(trackId) {
        if (this._trackStatsCache.has(trackId)) {
            return this._trackStatsCache.get(trackId);
        }

        return createTrackStats(trackId);
    }

    async updateTrackStats(trackId, updates) {
        let stats = this.getTrackStats(trackId);

        stats = {
            ...stats,
            ...updates,
            trackId,
            lastPlayedAt: Date.now(),
        };

        this._trackStatsCache.set(trackId, stats);
        await this._persistTrackStats();
    }

    async addListeningTime(trackId, seconds) {
        if (seconds <= 0)
            return;

        const stats = this.getTrackStats(trackId);
        const today = getDateString();

        stats.totalSeconds = (stats.totalSeconds || 0) + seconds;
        stats.lastPlayedAt = Date.now();

        if (!stats.dailySeconds)
            stats.dailySeconds = {};

        stats.dailySeconds[today] = (stats.dailySeconds[today] || 0) + seconds;
        this._trackStatsCache.set(trackId, stats);

        await this._updateDailyStats(seconds);
    }

    async incrementPlayCount(trackId) {
        const stats = this.getTrackStats(trackId);

        stats.playCount = (stats.playCount || 0) + 1;
        stats.lastPlayedAt = Date.now();

        this._trackStatsCache.set(trackId, stats);
        await this._persistTrackStats();
    }

    async _updateDailyStats(seconds) {
        const today = getDateString();
        const hour = getHour(Date.now());

        let dailyStats = this._dailyStatsCache.get(today);
        if (!dailyStats) {
            dailyStats = createDailyStats();
        }

        dailyStats.totalSeconds = (dailyStats.totalSeconds || 0) + seconds;
        if (!dailyStats.hourlySeconds)
            dailyStats.hourlySeconds = {};
        dailyStats.hourlySeconds[hour] = (dailyStats.hourlySeconds[hour] || 0) + seconds;

        this._dailyStatsCache.set(today, dailyStats);
        await this._persistDailyStats();
    }

    async recordSession(trackId, seconds, completed = false) {
        if (seconds < 5)
            return;

        const session = createSession(trackId);

        session.endedAt = Date.now();
        session.seconds = seconds;

        session.completed = completed;
        session.startedAt = session.endedAt - (seconds * 1000);

        const today = getDateString();
        let dailyStats = this._dailyStatsCache.get(today);

        if (!dailyStats) {
            dailyStats = createDailyStats();
        }

        dailyStats.sessionsCount = (dailyStats.sessionsCount || 0) + 1;
        this._dailyStatsCache.set(today, dailyStats);

        if (seconds >= 30) {
            await this.incrementPlayCount(trackId);
        }

        await this._persistDailyStats();
    }

    async markTrackPlayed(trackId) {
        const today = getDateString();
        let dailyStats = this._dailyStatsCache.get(today);

        if (!dailyStats) {
            dailyStats = createDailyStats();
        }

        if (!dailyStats.tracksPlayedSet) {
            dailyStats.tracksPlayedSet = [];
        }

        if (!dailyStats.tracksPlayedSet.includes(trackId)) {
            dailyStats.tracksPlayedSet.push(trackId);
            dailyStats.tracksPlayed = dailyStats.tracksPlayedSet.length;

            this._dailyStatsCache.set(today, dailyStats);
            await this._persistDailyStats();
        }
    }

    async _persistTrackStats() {
        const data = Object.fromEntries(this._trackStatsCache);
        await storageSync.set(STORAGE_KEYS.TRACKS, data);
    }

    async _persistDailyStats() {
        const data = Object.fromEntries(this._dailyStatsCache);
        await storageSync.set(STORAGE_KEYS.DAILY_STATS, data);
    }

    async getTopTracks(options = {}) {
        const {
            sortBy = "playCount",
            limit = 10,
            period = "all",
        } = options;

        const allStats = Array.from(this._trackStatsCache.values());
        let filtered = allStats;

        if (period !== "all") {
            const { start, end } = this._getDateRange(period); filtered = allStats.filter(s =>
                s.lastPlayedAt >= start && s.lastPlayedAt <= end
            );
        }

        filtered.sort((a, b) => {
            if (sortBy === "playCount") {
                return (b.playCount || 0) - (a.playCount || 0);
            }

            return (b.totalSeconds || 0) - (a.totalSeconds || 0);
        });

        const topTracks = [];
        for (const stats of filtered.slice(0, limit)) {
            const trackInfo = await this.getTrackInfo(stats.trackId);
            topTracks.push({
                ...stats,
                track: trackInfo,
            });
        }

        return topTracks;
    }

    async getTotalStats(period = "all") {
        const stats = {
            totalSeconds: 0,
            totalTracks: 0,
            totalPlays: 0,
            totalArtists: new Set(),
        };

        const { start, end } = this._getDateRange(period);

        for (const trackStats of this._trackStatsCache.values()) {
            if (period !== "all" &&
                (trackStats.lastPlayedAt < start || trackStats.lastPlayedAt > end)) {
                continue;
            }

            if (period === "all") {
                stats.totalSeconds += trackStats.totalSeconds || 0;
            } else {
                for (const [date, seconds] of Object.entries(trackStats.dailySeconds || {})) {
                    const dateTs = new Date(date).getTime();
                    if (dateTs >= start && dateTs <= end) {
                        stats.totalSeconds += seconds;
                    }
                }
            }

            stats.totalTracks++;
            stats.totalPlays += trackStats.playCount || 0;

            const trackInfo = await this.getTrackInfo(trackStats.trackId);
            if (trackInfo?.artistId) {
                stats.totalArtists.add(trackInfo.artistId);
            }
        }

        stats.totalArtists = stats.totalArtists.size;
        return stats;
    }

    getDailyStatsForPeriod(period = "month") {
        const { start, end } = this._getDateRange(period);
        const result = [];

        for (const [date, stats] of this._dailyStatsCache.entries()) {
            const dateTs = new Date(date).getTime();
            if (dateTs >= start && dateTs <= end) {
                result.push({ date, ...stats });
            }
        }

        result.sort((a, b) => new Date(a.date) - new Date(b.date));
        return result;
    }

    async getListeningPatterns(year) {
        const patterns = {
            byDayOfWeek: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
            byHour: {},
            byMonth: {},
        };

        for (let i = 0; i < 24; i++) {
            patterns.byHour[i] = 0;
        }

        for (let i = 1; i <= 12; i++) {
            patterns.byMonth[i] = 0;
        }

        const yearStart = new Date(year, 0, 1).getTime();
        const yearEnd = new Date(year, 11, 31, 23, 59, 59).getTime();

        for (const [date, stats] of this._dailyStatsCache.entries()) {
            const dateObj = new Date(date);
            const dateTs = dateObj.getTime();

            if (dateTs < yearStart || dateTs > yearEnd)
                continue;

            const dayOfWeek = dateObj.getDay();
            const month = dateObj.getMonth() + 1;

            patterns.byDayOfWeek[dayOfWeek] += stats.totalSeconds || 0;
            patterns.byMonth[month] += stats.totalSeconds || 0;

            for (const [hour, seconds] of Object.entries(stats.hourlySeconds || {})) {
                patterns.byHour[hour] = (patterns.byHour[hour] || 0) + seconds;
            }
        }

        return patterns;
    }

    _getDateRange(period) {
        const now = Date.now();
        const today = new Date();

        today.setHours(0, 0, 0, 0);

        switch (period) {
            case "today":
                return { start: today.getTime(), end: now };
            case "yesterday": {
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                return { start: yesterday.getTime(), end: today.getTime() - 1 };
            }
            case "week": {
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                return { start: weekAgo.getTime(), end: now };
            }
            case "month": {
                const monthAgo = new Date(today);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                return { start: monthAgo.getTime(), end: now };
            }
            case "year": {
                const yearStart = new Date(today.getFullYear(), 0, 1);
                return { start: yearStart.getTime(), end: now };
            }
            default:
                return { start: 0, end: now };
        }
    }

    async flush() {
        await this._persistTrackStats();
        await this._persistDailyStats();
        await storageSync.flush();
    }
}

export const storageManager = new StorageManager();
export default storageManager;