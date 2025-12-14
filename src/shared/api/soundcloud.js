import {
    ENDPOINTS,
    buildUrl,
    getAuthParams,
    DEFAULT_PARAMS
} from "./endpoints.js";
import { STORAGE_KEYS, ERRORS } from "../constants.js";

class SoundCloudAPI {
    constructor() {
        this.clientId = null;
        this.oauthToken = null;
        this.userId = null;
        this._initialized = false;
    }

    async init(options = {}) {
        if (options.clientId) {
            this.clientId = options.clientId;
        }

        if (options.oauthToken) {
            this.oauthToken = options.oauthToken;
        }

        if (!this.clientId) {
            await this._loadFromStorage();
        }

        this._initialized = true;
    }

    async _loadFromStorage() {
        try {
            const result = await chrome.storage.local.get([
                STORAGE_KEYS.CLIENT_ID,
                STORAGE_KEYS.SETTINGS,
            ]);

            const settings = result[STORAGE_KEYS.SETTINGS] || {};
            if (settings.customClientId) {
                this.clientId = settings.customClientId;
            } else if (result[STORAGE_KEYS.CLIENT_ID]) {
                this.clientId = result[STORAGE_KEYS.CLIENT_ID];
            }
        } catch (error) {
            console.error("[Soundcloud API] Failed to load credentials:", error);
        }
    }

    async setClientId(clientId) {
        this.clientId = clientId;
        try {
            await chrome.storage.local.set({
                [STORAGE_KEYS.CLIENT_ID]: clientId,
            });
        } catch (error) {
            console.error("[Soundcloud API] Failed to save client ID:", error);
        }
    }

    isReady() {
        return !!this.clientId;
    }

    async request(endpoint, params = {}, options = {}) {
        if (!this.clientId) {
            throw new Error(ERRORS.API_UNAVAILABLE);
        }

        const fullParams = {
            ...getAuthParams(this.clientId, this.oauthToken),
            ...params,
        };

        const url = buildUrl(endpoint, fullParams);

        try {
            const response = await fetch(url, {
                method: options.method || "GET",
                headers: {
                    "Accept": "application/json",
                    ...options.headers,
                },
                ...options,
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error(ERRORS.UNAUTHORIZED);
                }

                throw new Error(`API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error("[Soundcloud API] Request failed:", error);
            throw error;
        }
    }

    async getTrack(trackId) {
        return this.request(ENDPOINTS.TRACK(trackId));
    }

    async getTracks(trackIds) {
        if (!trackIds.length)
            return [];

        return this.request(ENDPOINTS.TRACKS, {
            ids: trackIds.join(","),
        });
    }

    async resolve(url) {
        return this.request(ENDPOINTS.RESOLVE, { url });
    }

    async getUser(userId) {
        return this.request(ENDPOINTS.USER(userId));
    }

    async getUserTracks(userId, options = {}) {
        return this.request(ENDPOINTS.USER_TRACKS(userId), {
            limit: options.limit || DEFAULT_PARAMS.limit,
            offset: options.offset || 0,
        });
    }

    async getUserLikes(userId, options = {}) {
        return this.request(ENDPOINTS.USER_LIKES(userId), {
            limit: options.limit || DEFAULT_PARAMS.limit,
            offset: options.offset || 0,
        });
    }

    async getMe() {
        return this.request(ENDPOINTS.ME);
    }

    async getMyLikes(options = {}) {
        return this.request(ENDPOINTS.ME_LIKES, {
            limit: options.limit || DEFAULT_PARAMS.limit,
            offset: options.offset || 0,
            linked_partitioning: 1,
        });
    }

    async getMyFollowings(options = {}) {
        return this.request(ENDPOINTS.ME_FOLLOWINGS, {
            limit: options.limit || DEFAULT_PARAMS.limit,
            offset: options.offset || 0,
        });
    }

    async isFollowing(artistId) {
        try {
            await this.request(`${ENDPOINTS.ME_FOLLOWINGS}/${artistId}`);
            return true;
        } catch {
            return false;
        }
    }

    async *paginate(requestFn, options = {}) {
        const limit = options.limit || 50;
        const maxItems = options.maxItems || Infinity;

        let offset = 0;
        let totalYielded = 0;

        while (totalYielded < maxItems) {
            const response = await requestFn({ limit, offset });
            const items = response.collection || response;

            if (!items || items.length === 0)
                break;

            for (const item of items) {
                if (totalYielded >= maxItems)
                    break;

                yield item;
                totalYielded++;
            }

            if (!response.next_href)
                break;

            offset += limit;
        }
    }

    async getAllUserLikes(userId, options = {}) {
        const likes = [];
        const maxLikes = options.maxItems || 500;

        for await (const like of this.paginate(
            (opts) => this.getUserLikes(userId, opts),
            { maxItems: maxLikes }
        )) {
            likes.push(like.track || like);
        }

        return likes;
    }

    normalizeTrack(apiTrack) {
        if (!apiTrack)
            return null;

        let artworkUrl = apiTrack.artwork_url;
        if (artworkUrl) {
            artworkUrl = artworkUrl.replace("-large", "-t500x500");
        } else if (apiTrack.user?.avatar_url) {
            artworkUrl = apiTrack.user.avatar_url.replace("-large", "-t500x500");
        }

        return {
            id: String(apiTrack.id),
            permalink: apiTrack.permalink_url ? new URL(apiTrack.permalink_url).pathname.slice(1) : `${apiTrack.user?.permalink}/${apiTrack.permalink}`,
            title: apiTrack.title || "Unknown Track",
            artistId: String(apiTrack.user?.id || ""),
            artistName: apiTrack.user?.username || "Unknown Artist",
            artistPermalink: apiTrack.user?.permalink || "",
            artworkUrl,
            duration: apiTrack.duration || 0,
            genre: apiTrack.genre || null,
            isLiked: false,
            scPlayCount: apiTrack.playback_count || null,
            createdAt: apiTrack.created_at,
            waveformUrl: apiTrack.waveform_url,
        };
    }

    normalizeArtist(apiUser) {
        if (!apiUser)
            return null;

        let avatarUrl = apiUser.avatar_url;
        if (avatarUrl) {
            avatarUrl = avatarUrl.replace("-large", "-t500x500");
        }

        return {
            id: String(apiUser.id),
            username: apiUser.username || "",
            permalink: apiUser.permalink || "",
            displayName: apiUser.full_name || apiUser.username || "Unknown Artist",
            avatarUrl,
            isFollowing: false,
            followersCount: apiUser.followers_count || null,
            trackCount: apiUser.track_count || 0,
            city: apiUser.city || null,
            country: apiUser.country_code || null,
        };
    }
}

export const soundCloudAPI = new SoundCloudAPI();
export default soundCloudAPI;