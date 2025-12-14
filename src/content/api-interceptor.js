import { MESSAGES } from "../shared/constants.js";

class APIInterceptor {
    constructor() {
        this._clientId = null;
        this._oauthToken = null;
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

        this._callbacks = { ...this._callbacks, ...callbacks }; this._injectInterceptor();
        window.addEventListener("message", this._handleMessage.bind(this)); this._initialized = true;
    }

    _injectInterceptor() {
        const script = document.createElement("script");
        script.textContent = `
            (function() {
                const CLOUD_TRAIL_INTERCEPTOR = true;
            
                const originalFetch = window.fetch;
                const originalXHROpen = XMLHttpRequest.prototype.open;
                const originalXHRSend = XMLHttpRequest.prototype.send;
                
                function isSCApi(url) {
                    return url && (
                        url.includes("api-v2.soundcloud.com") || 
                        url.includes("api.soundcloud.com")
                    );
                }
                
                function extractClientId(url) {
                    try {
                        const urlObj = new URL(url);
                        return urlObj.searchParams.get("client_id");
                    } catch {
                        return null;
                    }
                }
                
                function postToExtension(type, data) {
                    window.postMessage({
                        source: "cloudtrail-interceptor",
                        type: type,
                        data: data
                    }, "*");
                }
                
                window.fetch = async function(...args) {
                    const url = args[0]?.url || args[0];
                
                    if (typeof url === "string" && isSCApi(url)) {
                        const clientId = extractClientId(url);
                        if (clientId) {
                            postToExtension("CLIENT_ID", { clientId });
                        }
                        
                        try {
                            const response = await originalFetch.apply(this, args);
                            const clone = response.clone();
                            
                            if (url.includes("/tracks/") || url.includes("/stream")) {
                                clone.json().then(data => {
                                    if (data) {
                                        postToExtension("API_RESPONSE", { 
                                            url, 
                                            data,
                                            type: url.includes("/tracks/") ? "track" : "stream"
                                        });
                                    }
                                }).catch(() => {});
                            }
                            
                            return response;
                        } catch (error) {
                            throw error;
                        }
                    }
                    
                    return originalFetch.apply(this, args);
                };
                
                XMLHttpRequest.prototype.open = function(method, url, ...rest) {
                    this._cloudtrailUrl = url;
                    return originalXHROpen.apply(this, [method, url, ...rest]);
                };
                
                XMLHttpRequest.prototype.send = function(...args) {
                    const url = this._cloudtrailUrl;
                    
                    if (typeof url === "string" && isSCApi(url)) {
                        const clientId = extractClientId(url);
                        if (clientId) {
                            postToExtension("CLIENT_ID", { clientId });
                        }
                        
                        this.addEventListener("load", function() {
                            try {
                                if (this.responseType === "" || this.responseType === "text") {
                                    const data = JSON.parse(this.responseText);
                                    if (url.includes("/tracks/")) {
                                        postToExtension("API_RESPONSE", { 
                                            url, 
                                            data,
                                            type: "track"
                                        });
                                    }
                                }
                            } catch (e) { }
                        });
                    }
                    
                    return originalXHRSend.apply(this, args);
                };
                
                if (window.__sc_hydration) {
                    postToExtension("HYDRATION_DATA", window.__sc_hydration);
                }
                
                let hydrationData = window.__sc_hydration;
                Object.defineProperty(window, "__sc_hydration", {
                    get: function() { return hydrationData; },
                    set: function(val) {
                        hydrationData = val;
                        postToExtension("HYDRATION_DATA", val);
                    }
                });
            })();
        `;

        const target = document.head || document.documentElement;

        target.insertBefore(script, target.firstChild);
        script.remove();
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
        const { url, data, type } = responseData;

        if (type === "track" && data?.id) {
            this._cacheTrack(data);

            if (this._callbacks.onTrackData) {
                this._callbacks.onTrackData(data);
            }
        } else if (type === "stream" && data?.collection) {
            data.collection.forEach(item => {
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

                if (this._callbacks.onTrackData) {
                    this._callbacks.onTrackData(item.data);
                }
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

        this._trackCache.set(String(track.id), {
            ...track,
            cachedAt: Date.now(),
        });

        if (this._trackCache.size > 100) {
            const oldestKey = this._trackCache.keys().next().value;
            this._trackCache.delete(oldestKey);
        }
    }

    getCachedTrack(trackId) {
        return this._trackCache.get(String(trackId)) || null;
    }

    getCachedTrackByPermalink(permalink) {
        for (const track of this._trackCache.values()) {
            const trackPermalink = track.permalink_url ? new URL(track.permalink_url).pathname.slice(1) : `${track.user?.permalink}/${track.permalink}`;
            if (trackPermalink === permalink) {
                return track;
            }
        }

        return null;
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
            scPlayCount: apiTrack.playback_count || null,
            source: "api",
        };
    }
}

export const apiInterceptor = new APIInterceptor();
export default apiInterceptor;