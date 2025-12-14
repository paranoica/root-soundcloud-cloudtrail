import { SOUNDCLOUD } from "../shared/constants.js";
const SELECTORS = SOUNDCLOUD.SELECTORS;

class DOMExtractor {
    constructor() {
        this._cache = {
            lastTrack: null,
            lastExtractTime: 0,
        };
        this._extractDebounce = 100;
    }

    extractCurrentTrack() {
        try {
            const now = Date.now();
            if (now - this._cache.lastExtractTime < this._extractDebounce) {
                return this._cache.lastTrack;
            }

            const track = this._extractTrackFromPlayer();

            this._cache.lastTrack = track;
            this._cache.lastExtractTime = now;

            return track;
        } catch (error) {
            console.error("[DOM Extractor] Extract error:", error);
            return null;
        }
    }

    _extractTrackFromPlayer() {
        const titleEl = document.querySelector(SELECTORS.TRACK_TITLE);
        if (!titleEl)
            return null;

        const title = titleEl.textContent?.trim();
        if (!title)
            return null;

        const artistEl = document.querySelector(SELECTORS.TRACK_ARTIST);
        const artistName = artistEl?.textContent?.trim() || "Unknown Artist";

        let artworkUrl = null;
        const artworkEl = document.querySelector(SELECTORS.TRACK_ARTWORK);

        if (artworkEl) {
            const style = artworkEl.getAttribute("style") || "";
            const match = style.match(/url\([""]?([^"")\s]+)[""]?\)/);

            if (match) {
                artworkUrl = match[1].replace("-t50x50", "-t500x500").replace("-large", "-t500x500");
            }
        }

        const trackUrl = titleEl.getAttribute("href") || "";
        const permalink = trackUrl.replace(/^\//, "");

        const trackId = this._extractTrackId(titleEl, permalink);
        const duration = this._extractDuration();

        return {
            id: trackId,
            title,
            artistName,
            artistPermalink: this._extractArtistPermalink(artistEl),
            artworkUrl,
            permalink,
            duration,
            extractedAt: Date.now(),
            source: "dom",
        };
    }

    _extractTrackId(titleEl, permalink) {
        const container = titleEl.closest("[data-track-id]");
        if (container) {
            return container.getAttribute("data-track-id");
        }

        const soundBadge = titleEl.closest(".playbackSoundBadge");
        if (soundBadge) {
            const trackIdAttr = soundBadge.querySelector("[data-track-id]"); if (trackIdAttr) {
                return trackIdAttr.getAttribute("data-track-id");
            }
        }

        if (permalink) {
            return `temp_${this._hashString(permalink)}`;
        }

        return null;
    }

    _extractArtistPermalink(artistEl) {
        if (!artistEl)
            return "";

        const href = artistEl.getAttribute("href") || "";
        return href.replace(/^\//, "").split("/")[0];
    }

    _extractDuration() {
        const durationEl = document.querySelector(SELECTORS.TIME_DURATION);
        if (!durationEl)
            return 0;

        const timeText = durationEl.textContent?.trim();
        return this._parseTimeString(timeText);
    }

    getCurrentPosition() {
        const passedEl = document.querySelector(SELECTORS.TIME_PASSED);
        if (!passedEl)
            return 0;

        const timeText = passedEl.textContent?.trim();
        return Math.floor(this._parseTimeString(timeText) / 1000);
    }

    isPlaying() {
        const playButton = document.querySelector(SELECTORS.PLAY_BUTTON);
        if (!playButton)
            return false;

        if (playButton.classList.contains(SELECTORS.PLAYING_CLASS)) {
            return true;
        }

        const label = playButton.getAttribute("aria-label") || playButton.getAttribute("title") || "";
        return label.toLowerCase().includes("pause");
    }

    isLiked() {
        const likeButton = document.querySelector(SELECTORS.LIKE_BUTTON);
        if (!likeButton)
            return false;

        return likeButton.classList.contains("sc-button-selected") || likeButton.getAttribute("aria-pressed") === "true";
    }

    _parseTimeString(timeStr) {
        if (!timeStr)
            return 0;

        const parts = timeStr.split(":").map(Number);
        if (parts.length === 2) {
            return (parts[0] * 60 + parts[1]) * 1000;
        } else if (parts.length === 3) {
            return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
        }

        return 0;
    }

    _hashString(str) {
        let hash = 0;

        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);

            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }

        return Math.abs(hash).toString(36);
    }

    getPlayerContainer() {
        return document.querySelector(SELECTORS.PLAYER_CONTAINER);
    }

    hasPlayer() {
        return !!this.getPlayerContainer();
    }

    extractPageTracks() {
        const tracks = [];
        const trackItems = document.querySelectorAll(".soundList__item, .trackItem");

        trackItems.forEach(item => {
            try {
                const titleEl = item.querySelector(".soundTitle__title, .trackItem__trackTitle");
                const artistEl = item.querySelector(".soundTitle__username, .trackItem__username");

                if (titleEl) {
                    const href = titleEl.getAttribute("href") || ""; tracks.push({
                        permalink: href.replace(/^\//, ""),
                        title: titleEl.textContent?.trim(),
                        artistName: artistEl?.textContent?.trim(),
                    });
                }
            } catch (e) { }
        });

        return tracks;
    }
}

export const domExtractor = new DOMExtractor();
export default domExtractor;