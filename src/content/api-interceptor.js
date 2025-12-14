import { MESSAGES } from "../shared/constants.js";

class APIInterceptor {
    constructor() {
        this._clientId = null;
        this._trackCache = new Map();
        this._callbacks = {
            onClientId: null,
            onTrackData: null,
            onUserData: null,
        };
        this._initialized = false;
    }

    init(callbacks = {}) {
        if (this._initialized)
            return;

        this._callbacks = { ...this._callbacks, ...callbacks };
        this._injectInterceptor();

        window.addEventListener("message", this._handleMessage.bind(this));
        this._initialized = true;
    }

    _injectInterceptor() {
        const scriptUrl = chrome.runtime.getURL("src/content/inject.js");
        const script = document.createElement("script");

        script.src = scriptUrl;
        script.onload = function () {
            this.remove();
        };

        (document.head || document.documentElement).appendChild(script);
    }

    _handleMessage(event) {
        if (event.source !== window || !event.data || event.data.source !== "cloudtrail-interceptor") {
            return;
        }

        const { type, data } = event.data;

        switch (type) {
            case "CLIENT_ID":
                this._handleClientId(data.clientId);
                break;
            case "API_RESPONSE":
                this._handleAPIResponse(data);
                break;
            case "HYDRATION_DATA":
                this._handleHydrationData(data);
                break;
        }
    }

    _handleClientId(clientId) {
        if (!clientId || clientId === this._clientId)
            return;

        this._clientId = clientId;
        if (this._callbacks.onClientId) {
            this._callbacks.onClientId(clientId);
        }

        chrome.runtime.sendMessage({
            type: MESSAGES.CLIENT_ID_FOUND,
            data: { clientId },
        }).catch(() => { });
    }

    _handleAPIResponse(responseData) {
        const { url, data } = responseData;

        if (url.includes("/play-history") && data.track) {
            this._cacheTrack(data.track);
        } else if (url.includes("/tracks/") && data.id) {
            this._cacheTrack(data);
        } else if ((url.includes("/stream") || url.includes("/tracks")) && (data.collection || Array.isArray(data))) {
            const list = data.collection || data;
            list.forEach(item => {
                const track = item.track || item;
                if (track?.id) {
                    this._cacheTrack(track);
                }
            });
        }
    }

    _handleHydrationData(hydrationData) {
        if (!Array.isArray(hydrationData))
            return;

        for (const item of hydrationData) {
            if (item.hydratable === "sound" && item.data) {
                this._cacheTrack(item.data);
            } else if (item.hydratable === "user" && item.data) {
                if (this._callbacks.onUserData) {
                    this._callbacks.onUserData(item.data);
                }
            }
        }
    }

    _cacheTrack(track) {
        if (!track?.id)
            return;

        const normalizedTrack = this.normalizeTrack(track);
        this._trackCache.set(String(track.id), normalizedTrack);

        if (track.permalink_url) {
            try {
                const permalink = new URL(track.permalink_url).pathname.slice(1);
                this._trackCache.set(permalink, normalizedTrack);
            } catch (e) { }
        }

        if (this._callbacks.onTrackData) {
            this._callbacks.onTrackData(normalizedTrack);
        }
    }

    getCachedTrack(trackId) {
        return this._trackCache.get(String(trackId)) || null;
    }

    getCachedTrackByPermalink(permalink) {
        return this._trackCache.get(permalink) || null;
    }

    getClientId() {
        return this._clientId;
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
            scPlayCount: apiTrack.playback_count || 0,
            source: "api",
        };
    }
}

export const apiInterceptor = new APIInterceptor();
export default apiInterceptor;