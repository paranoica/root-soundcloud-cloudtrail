import { formatNumber } from "../../shared/i18n/index.js";

export class TopTracks {
    constructor(container) {
        this.container = container;
        this.emptyState = document.getElementById("empty-tracks");
        this.tracks = [];
    }

    render(tracks) {
        this.tracks = tracks;

        if (!tracks || tracks.length === 0) {
            this._showEmpty();
            return;
        }

        this._hideEmpty();
        this.container.innerHTML = tracks.map((track, index) =>
            this._renderTrackItem(track, index + 1)
        ).join("");

        this.container.querySelectorAll(".track-item").forEach((item, index) => {
            item.addEventListener("click", () => this._onTrackClick(tracks[index]));
        });
    }

    _renderTrackItem(track, rank) {
        const artworkHtml = track.track?.artworkUrl
            ? `<img src="${this._getSmallArtwork(track.track.artworkUrl)}" alt="" loading="lazy">`
            : `<div class="track-item__artwork-placeholder">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                </div>
            `;

        const title = track.track?.title || "Unknown Track";
        const artist = track.track?.artistName || "Unknown Artist";
        const playCount = track.playCount || 0;

        return `
            <div class="track-item" data-track-id="${track.trackId}">
                <div class="track-item__rank">${rank}</div>
                <div class="track-item__artwork">
                    ${artworkHtml}
                </div>
                <div class="track-item__info">
                    <div class="track-item__title" title="${this._escapeHtml(title)}">${this._escapeHtml(title)}</div>
                    <div class="track-item__artist" title="${this._escapeHtml(artist)}">${this._escapeHtml(artist)}</div>
                </div>
                <div class="track-item__plays">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    ${formatNumber(playCount)}
                </div>
            </div>
        `;
    }

    showLoading() {
        this._hideEmpty();
        this.container.innerHTML = Array(5).fill(null).map(() => `
            <div class="skeleton-track">
                <div class="skeleton-track__rank skeleton"></div>
                <div class="skeleton-track__artwork skeleton"></div>
                <div class="skeleton-track__info">
                    <div class="skeleton-track__title skeleton"></div>
                    <div class="skeleton-track__artist skeleton"></div>
                </div>
                <div class="skeleton-track__plays skeleton"></div>
            </div>
        `).join("");
    }
    
    _showEmpty() {
        this.container.innerHTML = "";
        if (this.emptyState) {
            this.emptyState.classList.remove("hidden");
        }
    }

    _hideEmpty() {
        if (this.emptyState) {
            this.emptyState.classList.add("hidden");
        }
    }

    _onTrackClick(track) {
        if (track.track?.permalink) {
            chrome.tabs.create({
                url: `https://soundcloud.com/${track.track.permalink}`,
            });
        }
    }

    _getSmallArtwork(url) {
        if (!url)
            return "";

        return url.replace("-t500x500", "-t200x200").replace("-large", "-t200x200");
    }

    _escapeHtml(text) {
        const div = document.createElement("div"); div.textContent = text;
        return div.innerHTML;
    }
}

export function createTopTracks(container) {
    return new TopTracks(container);
}