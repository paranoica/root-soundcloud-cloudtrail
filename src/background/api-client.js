import soundCloudAPI from "../shared/api/soundcloud.js";
import { storageManager } from "./storage-manager.js";

class BackgroundAPIClient {
    constructor() {
        this._requestQueue = [];
        this._isProcessing = false;
        this._rateLimitDelay = 100;
    }

    async init() {
        await soundCloudAPI.init();
    }

    async setClientId(clientId) {
        if (!clientId)
            return;

        await soundCloudAPI.setClientId(clientId);
    }

    isReady() {
        return soundCloudAPI.isReady();
    }

    async getTrack(trackId, forceRefresh = false) {
        if (!forceRefresh) {
            const cached = await storageManager.getTrackInfo(trackId);
            if (cached && this._isCacheValid(cached.cachedAt)) {
                return cached;
            }
        }

        if (!this.isReady()) {
            console.warn("[API Client] Not ready, returning cached data");
            return await storageManager.getTrackInfo(trackId);
        }

        try {
            const apiTrack = await soundCloudAPI.getTrack(trackId);
            const normalized = soundCloudAPI.normalizeTrack(apiTrack);

            await storageManager.saveTrackInfo(normalized);
            return normalized;
        } catch (error) {
            console.error("[API Client] Failed to get track:", error);
            return await storageManager.getTrackInfo(trackId);
        }
    }

    async getTracks(trackIds) {
        const results = [];
        const uncached = [];

        for (const trackId of trackIds) {
            const cached = await storageManager.getTrackInfo(trackId);
            if (cached && this._isCacheValid(cached.cachedAt)) {
                results.push(cached);
            } else {
                uncached.push(trackId);
            }
        }

        if (uncached.length > 0 && this.isReady()) {
            try {
                const apiTracks = await soundCloudAPI.getTracks(uncached);
                for (const apiTrack of apiTracks) {
                    const normalized = soundCloudAPI.normalizeTrack(apiTrack);

                    await storageManager.saveTrackInfo(normalized);
                    results.push(normalized);
                }
            } catch (error) {
                console.error("[API Client] Failed to get tracks:", error);
            }
        }

        return results;
    }

    async resolve(url) {
        if (!this.isReady())
            return null;

        try {
            const resource = await soundCloudAPI.resolve(url);

            if (resource.kind === "track") {
                const normalized = soundCloudAPI.normalizeTrack(resource);

                await storageManager.saveTrackInfo(normalized);
                return normalized;
            }

            return resource;
        } catch (error) {
            console.error("[API Client] Resolve failed:", error);
            return null;
        }
    }

    async getMyLikes(options = {}) {
        if (!this.isReady())
            return [];

        try {
            const likes = await soundCloudAPI.getMyLikes(options);
            const tracks = [];

            for (const item of likes.collection || []) {
                const track = item.track || item;
                const normalized = soundCloudAPI.normalizeTrack(track);

                if (normalized) {
                    normalized.isLiked = true;
                    await storageManager.saveTrackInfo(normalized);
                    tracks.push(normalized);
                }
            }

            return tracks;
        } catch (error) {
            console.error("[API Client] Get likes failed:", error);
            return [];
        }
    }

    async importLikedTracks(progressCallback = null) {
        if (!this.isReady()) {
            throw new Error("API not ready");
        }

        const result = {
            imported: 0,
            skipped: 0,
            errors: 0,
            tracks: [],
        };

        try {
            let offset = 0;
            const limit = 50;
            let hasMore = true;

            while (hasMore) {
                const response = await soundCloudAPI.getMyLikes({ limit, offset });
                const items = response.collection || [];

                if (items.length === 0) {
                    hasMore = false;
                    break;
                }

                for (const item of items) {
                    const track = item.track || item;

                    try {
                        const normalized = soundCloudAPI.normalizeTrack(track);
                        if (!normalized) {
                            result.skipped++;
                            continue;
                        }

                        normalized.isLiked = true;
                        await storageManager.saveTrackInfo(normalized);

                        if (track.playback_count) {
                            normalized.scPlayCount = track.playback_count;
                        }

                        result.tracks.push(normalized);
                        result.imported++;

                        if (progressCallback) {
                            progressCallback({
                                current: result.imported,
                                total: response.total_results || result.imported,
                                track: normalized,
                            });
                        }
                    } catch (err) {
                        result.errors++;
                        console.error("[API Client] Track import error:", err);
                    }
                }

                offset += limit;
                hasMore = !!response.next_href;

                await new Promise(r => setTimeout(r, this._rateLimitDelay));
            }
        } catch (error) {
            console.error("[API Client] Import failed:", error);
            throw error;
        }

        return result;
    }

    async checkFollowing(artistId) {
        if (!this.isReady())
            return false;

        try {
            return await soundCloudAPI.isFollowing(artistId);
        } catch {
            return false;
        }
    }

    async getArtist(artistId) {
        const cache = await storageSync.get(STORAGE_KEYS.ARTIST_CACHE, {});
        if (cache[artistId] && this._isCacheValid(cache[artistId].cachedAt, 7 * 24 * 60 * 60 * 1000)) {
            return cache[artistId];
        }

        if (!this.isReady()) {
            return cache[artistId] || null;
        }

        try {
            const apiUser = await soundCloudAPI.getUser(artistId);
            const normalized = soundCloudAPI.normalizeArtist(apiUser);

            normalized.cachedAt = Date.now();
            cache[artistId] = normalized;

            const entries = Object.entries(cache);
            if (entries.length > 200) {
                entries.sort((a, b) => (b[1].cachedAt || 0) - (a[1].cachedAt || 0));
                const newCache = Object.fromEntries(entries.slice(0, 200));
                
                await storageSync.set(STORAGE_KEYS.ARTIST_CACHE, newCache);
            } else {
                await storageSync.set(STORAGE_KEYS.ARTIST_CACHE, cache);
            }

            return normalized;
        } catch (error) {
            console.error("[API Client] Failed to get artist:", error);
            return cache[artistId] || null;
        }
    }

    _isCacheValid(cachedAt) {
        if (!cachedAt)
            return false;

        const TTL = 24 * 60 * 60 * 1000;
        return Date.now() - cachedAt < TTL;
    }
}

export const apiClient = new BackgroundAPIClient();
export default apiClient;