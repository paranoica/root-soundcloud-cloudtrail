export class NowPlaying {
    constructor() {
        this.container = document.getElementById("now-playing");
        this.artworkContainer = document.getElementById("now-playing-artwork");

        this.titleEl = document.getElementById("now-playing-title");
        this.artistEl = document.getElementById("now-playing-artist");
        this.indicator = document.getElementById("playing-indicator");

        this._isPlaying = false;
        this._currentTrack = null;
    }

    update(status) {
        const { isPlaying, currentTrack } = status;

        this._isPlaying = isPlaying;
        this._currentTrack = currentTrack;

        if (currentTrack) {
            this._updateTrackInfo(currentTrack);
        } else {
            this._showEmpty();
        }

        this._updatePlayingState(isPlaying && currentTrack);
    }

    _updateTrackInfo(track) {
        if (this.titleEl) {
            this.titleEl.textContent = track.title || "Unknown Track";
            this.titleEl.title = track.title || "";
        }

        if (this.artistEl) {
            this.artistEl.textContent = track.artistName || "Unknown Artist";
            this.artistEl.title = track.artistName || "";
        }

        this._updateArtwork(track.artworkUrl);
    }

    _updateArtwork(artworkUrl) {
        if (!this.artworkContainer)
            return;

        if (artworkUrl) {
            const smallUrl = artworkUrl.replace("-t500x500", "-t200x200").replace("-large", "-t200x200");

            this.artworkContainer.innerHTML = `
                <img src="${smallUrl}" alt="" loading="lazy" onerror="this.parentElement.innerHTML = '<div class=\\'now-playing__placeholder\\'><svg viewBox=\\'0 0 24 24\\' fill=\\'currentColor\\'><path d=\\'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z\\'/></svg></div>'">
            `;
        } else {
            this.artworkContainer.innerHTML = `
                <div class="now-playing__placeholder">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                </div>
            `;
        }
    }

    _updatePlayingState(isPlaying) {
        if (!this.container)
            return;

        this.container.classList.toggle("is-playing", isPlaying);
    }

    _showEmpty() {
        if (this.titleEl) {
            this.titleEl.textContent = "Nothing playing";
        }

        if (this.artistEl) {
            this.artistEl.textContent = "Open SoundCloud to start tracking";
        }

        this._updateArtwork(null);
    }

    getState() {
        return {
            isPlaying: this._isPlaying,
            currentTrack: this._currentTrack,
        };
    }
}

export function createNowPlaying() {
    return new NowPlaying();
}