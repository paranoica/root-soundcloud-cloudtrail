import { MESSAGES, TIME } from "../shared/constants.js";
import { domExtractor } from "./dom-extractor.js";
import { apiInterceptor } from "./api-interceptor.js";
import { debounce } from "../shared/utils/debounce.js";

class PlayerObserver {
    constructor() {
        this._state = {
            isPlaying: false,
            currentTrack: null,
            lastTrackId: null,
        };

        this._observer = null;
        this._pollInterval = null;
        this._initialized = false;

        this._debouncedTrackChange = debounce(
            this._handleTrackChange.bind(this),
            TIME.DEBOUNCE_TRACK_CHANGE
        );
    }

    init() {
        if (this._initialized)
            return;

        apiInterceptor.init({
            onTrackData: this._onApiTrackData.bind(this),
            onClientId: (clientId) => {
                console.log("[Player Observer] Got client ID from API");
            },
        });

        this._waitForPlayer();
        this._initialized = true;
    }

    _waitForPlayer() {
        if (domExtractor.hasPlayer()) {
            this._setupObserver();
            return;
        }

        const bodyObserver = new MutationObserver((mutations, observer) => {
            if (domExtractor.hasPlayer()) {
                observer.disconnect();
                this._setupObserver();
            }
        });

        bodyObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });

        setTimeout(() => {
            bodyObserver.disconnect();

            if (domExtractor.hasPlayer()) {
                this._setupObserver();
            } else {
                this._startPolling();
            }
        }, 10000);
    }

    _setupObserver() {
        const playerContainer = domExtractor.getPlayerContainer();
        if (!playerContainer)
            return;

        this._checkPlayState();
        this._observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === "attributes") {
                    if (mutation.attributeName === "class" ||
                        mutation.attributeName === "aria-label") {
                        this._checkPlayState();
                    }
                } else if (mutation.type === "childList" || mutation.type === "characterData") {
                    this._debouncedTrackChange();
                }
            }
        });

        this._observer.observe(playerContainer, {
            attributes: true,
            childList: true,
            subtree: true,
            characterData: true,
            attributeFilter: ["class", "aria-label", "aria-pressed", "title"],
        });

        this._startPolling();
    }

    _startPolling() {
        if (this._pollInterval)
            return;

        this._pollInterval = setInterval(() => {
            this._checkPlayState();
        }, 1000);
    }

    _stopPolling() {
        if (this._pollInterval) {
            clearInterval(this._pollInterval);
            this._pollInterval = null;
        }
    }

    _checkPlayState() {
        const isPlaying = domExtractor.isPlaying();
        const wasPlaying = this._state.isPlaying;

        if (isPlaying !== wasPlaying) {
            this._state.isPlaying = isPlaying;

            if (isPlaying) {
                this._onPlay();
            } else {
                this._onPause();
            }
        }

        if (isPlaying) {
            const currentTrack = this._getCurrentTrack();
            if (currentTrack && currentTrack.id !== this._state.lastTrackId) {
                this._handleTrackChange();
            }
        }
    }

    _getCurrentTrack() {
        const domTrack = domExtractor.extractCurrentTrack();
        if (!domTrack)
            return null;

        if (domTrack.id && !domTrack.id.startsWith("temp_")) {
            const apiTrack = apiInterceptor.getCachedTrack(domTrack.id);
            if (apiTrack) {
                return apiInterceptor.normalizeTrack(apiTrack);
            }
        }

        if (domTrack.permalink) {
            const apiTrack = apiInterceptor.getCachedTrackByPermalink(domTrack.permalink);
            if (apiTrack) {
                return apiInterceptor.normalizeTrack(apiTrack);
            }
        }

        return domTrack;
    }

    async _onPlay() {
        const track = this._getCurrentTrack();
        if (!track) {
            console.warn("[Player Observer] Play detected but no track info");
            return;
        }

        this._state.currentTrack = track;
        this._state.lastTrackId = track.id;

        try {
            await chrome.runtime.sendMessage({
                type: MESSAGES.TRACK_PLAYING,
                data: { track },
            });
        } catch (error) {
            console.error("[Player Observer] Failed to send play message:", error);
        }
    }

    async _onPause() {
        try {
            await chrome.runtime.sendMessage({
                type: MESSAGES.TRACK_PAUSED,
                data: {},
            });
        } catch (error) {
            console.error("[Player Observer] Failed to send pause message:", error);
        }
    }

    async _handleTrackChange() {
        const track = this._getCurrentTrack();
        if (!track || track.id === this._state.lastTrackId) {
            return;
        }

        const previousTrack = this._state.currentTrack;

        this._state.currentTrack = track;
        this._state.lastTrackId = track.id;

        if (previousTrack) {
            try {
                await chrome.runtime.sendMessage({
                    type: MESSAGES.TRACK_ENDED,
                    data: {},
                });
            } catch (error) { }
        }

        if (this._state.isPlaying) {
            try {
                await chrome.runtime.sendMessage({
                    type: MESSAGES.TRACK_CHANGED,
                    data: { track },
                });
            } catch (error) {
                console.error("[Player Observer] Failed to send track change:", error);
            }
        }
    }

    _onApiTrackData(apiTrack) {
        if (!this._state.currentTrack)
            return;

        const normalizedId = String(apiTrack.id);
        const currentId = String(this._state.currentTrack.id);

        if (normalizedId === currentId ||
            this._state.currentTrack.id.startsWith("temp_")) {
            const enrichedTrack = apiInterceptor.normalizeTrack(apiTrack);

            if (this._state.currentTrack.permalink === enrichedTrack.permalink) {
                this._state.currentTrack = enrichedTrack;
                this._state.lastTrackId = enrichedTrack.id;

                if (this._state.isPlaying) {
                    chrome.runtime.sendMessage({
                        type: MESSAGES.TRACK_PLAYING,
                        data: { track: enrichedTrack },
                    }).catch(() => { });
                }
            }
        }
    }

    getState() {
        return {
            isPlaying: this._state.isPlaying,
            currentTrack: this._state.currentTrack,
        };
    }

    destroy() {
        if (this._observer) {
            this._observer.disconnect();
            this._observer = null;
        }

        this._stopPolling();
        this._initialized = false;
    }
}

export const playerObserver = new PlayerObserver();
export default playerObserver;