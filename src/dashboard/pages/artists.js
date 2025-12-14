import { MESSAGES } from "../../shared/constants.js";
import { formatDuration } from "../../shared/utils/time.js";
import { formatNumber } from "../../shared/i18n/index.js";
import { debounce } from "../../shared/utils/debounce.js";

export class ArtistsPage {
    constructor(options = {}) {
        this.container = options.container;
        this.period = options.period || "all";

        this._artists = [];
        this._filteredArtists = [];
        this._searchQuery = "";
        this._sortBy = "totalSeconds";
        this._currentPage = 1;
        this._perPage = 20;

        this._debouncedSearch = debounce(this._performSearch.bind(this), 300);
    }

    async render() {
        this.container.innerHTML = this._getTemplate();
        this._bindEvents();

        await this.loadData();
    }

    async loadData() {
        this._showLoading();

        try {
            const tracks = await this._sendMessage(MESSAGES.GET_TOP_TRACKS, {
                period: this.period,
                limit: 500,
                sortBy: "totalSeconds",
            });

            this._artists = this._aggregateArtists(tracks || []);
            this._applyFilters();
            this._renderArtists();
            this._updateStats();
        } catch (error) {
            console.error("[Artists] Load failed:", error);
            this._showError();
        }
    }

    async updatePeriod(period) {
        this.period = period;
        this._currentPage = 1;

        await this.loadData();
    }

    _aggregateArtists(tracks) {
        const artistMap = new Map(); tracks.forEach(item => {
            const track = item.track;
            if (!track?.artistId)
                return;

            const existing = artistMap.get(track.artistId) || {
                id: track.artistId,
                name: track.artistName || "Unknown Artist",
                permalink: track.artistPermalink || "",
                avatarUrl: null,
                totalSeconds: 0,
                playCount: 0,
                trackCount: 0,
                tracks: [],
            };

            existing.totalSeconds += item.totalSeconds || 0;
            existing.playCount += item.playCount || 0;
            existing.trackCount++;
            existing.tracks.push({
                title: track.title,
                playCount: item.playCount,
                artworkUrl: track.artworkUrl,
            });

            if (!existing.avatarUrl && track.artworkUrl) {
                existing.avatarUrl = track.artworkUrl;
            }

            artistMap.set(track.artistId, existing);
        });

        return Array.from(artistMap.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
    }

    _bindEvents() {
        const searchInput = this.container.querySelector("#artists-search");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                this._searchQuery = e.target.value;
                this._debouncedSearch();
            });
        }

        const sortTabs = this.container.querySelectorAll(".tab"); sortTabs.forEach(tab => {
            tab.addEventListener("click", () => {
                const sort = tab.dataset.sort;
                this._setSortBy(sort);
            });
        });

        this.container.addEventListener("click", (e) => {
            const btn = e.target.closest(".pagination__btn");
            if (btn) {
                const page = btn.dataset.page;
                if (page === "prev")
                    this._goToPage(this._currentPage - 1);
                else if (page === "next")
                    this._goToPage(this._currentPage + 1);
                else
                    this._goToPage(parseInt(page));
            }
        });
    }

    _getTemplate() {
        return `
            <div class="artists-page">
                <div class="page-toolbar">
                    <div class="page-toolbar__left">
                        <div class="search-input">
                            <svg class="search-input__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8"/>
                                <path d="M21 21l-4.35-4.35"/>
                            </svg>
                            <input 
                                type="text" 
                                id="artists-search" 
                                placeholder="Search artists..."
                                autocomplete="off"
                            >
                        </div>
                        
                        <div class="page-toolbar__stats">
                            <span id="artists-count">0 artists</span>
                        </div>
                    </div>
                
                    <div class="page-toolbar__right">
                        <div class="tabs">
                            <button class="tab active" data-sort="totalSeconds">By Time</button>
                            <button class="tab" data-sort="playCount">By Plays</button>
                            <button class="tab" data-sort="trackCount">By Tracks</button>
                        </div>
                    </div>
                </div>

                <div class="artists-grid" id="artists-grid">
                    ${this._getLoadingSkeleton()}
                </div>

                <div class="pagination" id="pagination"></div>
            </div>
        `;
    }

    _performSearch() {
        this._currentPage = 1;
        this._applyFilters();
        this._renderArtists();
    }

    _applyFilters() {
        let filtered = [...this._artists];
        if (this._searchQuery) {
            const query = this._searchQuery.toLowerCase(); filtered = filtered.filter(artist =>
                artist.name.toLowerCase().includes(query)
            );
        }

        filtered.sort((a, b) => {
            switch (this._sortBy) {
                case "playCount":
                    return b.playCount - a.playCount;
                case "trackCount":
                    return b.trackCount - a.trackCount;
                default:
                    return b.totalSeconds - a.totalSeconds;
            }
        });

        this._filteredArtists = filtered;
    }

    _setSortBy(sortBy) {
        this._sortBy = sortBy;
        this._currentPage = 1;

        this.container.querySelectorAll(".tab").forEach(tab => {
            tab.classList.toggle("active", tab.dataset.sort === sortBy);
        });

        this._applyFilters();
        this._renderArtists();
    }

    _renderArtists() {
        const container = this.container.querySelector("#artists-grid");
        if (!container)
            return;

        if (this._filteredArtists.length === 0) {
            container.innerHTML = this._getEmptyState();
            this._renderPagination(); return;
        }

        const start = (this._currentPage - 1) * this._perPage;
        const end = start + this._perPage;

        const pageArtists = this._filteredArtists.slice(start, end); container.innerHTML = pageArtists.map((artist, index) =>
            this._renderArtistCard(artist, start + index + 1)
        ).join("");

        container.querySelectorAll(".artist-card-lg").forEach(card => {
            card.addEventListener("click", () => {
                const permalink = card.dataset.permalink;
                if (permalink) {
                    chrome.tabs.create({ url: `https://soundcloud.com/${permalink}` });
                }
            });
        });

        this._renderPagination();
    }

    _renderArtistCard(artist, rank) {
        const initial = artist.name.charAt(0).toUpperCase();
        const topTracks = artist.tracks.sort((a, b) => b.playCount - a.playCount).slice(0, 3);

        return `
            <div class="artist-card-lg" data-permalink="${artist.permalink}">
                <div class="artist-card-lg__header">
                    <div class="artist-card-lg__rank ${rank <= 3 ? "artist-card-lg__rank--" + rank : ""}">${rank}</div>
                    <div class="artist-card-lg__avatar">
                        ${artist.avatarUrl
                            ? `<img src="${this._getSmallArtwork(artist.avatarUrl)}" alt="" loading="lazy">`
                            : `<div class="artist-card-lg__initial">${initial}</div>`
                        }
                    </div>
                    <div class="artist-card-lg__info">
                        <div class="artist-card-lg__name">${this._escapeHtml(artist.name)}</div>
                        <div class="artist-card-lg__meta">${artist.trackCount} tracks listened</div>
                    </div>
                </div>
                
                <div class="artist-card-lg__stats">
                    <div class="artist-stat">
                        <div class="artist-stat__value">${formatDuration(artist.totalSeconds, { showSeconds: false })}</div>
                        <div class="artist-stat__label">Listen Time</div>
                    </div>
                    <div class="artist-stat">
                        <div class="artist-stat__value">${formatNumber(artist.playCount)}</div>
                        <div class="artist-stat__label">Total Plays</div>
                    </div>
                </div>

                <div class="artist-card-lg__tracks">
                    <div class="artist-card-lg__tracks-label">Top Tracks</div>
                    <div class="artist-card-lg__tracks-list">
                        ${topTracks.map(track => `
                            <div class="mini-track">
                                <div class="mini-track__artwork">
                                    ${
                                        track.artworkUrl
                                        ? `<img src="${this._getSmallArtwork(track.artworkUrl)}" alt="">`
                                        : ""
                                    }
                                </div>
                                <div class="mini-track__title">${this._escapeHtml(track.title)}</div>
                                <div class="mini-track__plays">${formatNumber(track.playCount)}</div>
                            </div>
                        `).join("")}
                    </div>
                </div>
            </div>
        `;
    }

    _renderPagination() {
        const container = this.container.querySelector("#pagination");
        if (!container)
            return;

        const totalPages = Math.ceil(this._filteredArtists.length / this._perPage);
        if (totalPages <= 1) {
            container.innerHTML = "";
            return;
        }

        container.innerHTML = `
            <button class="pagination__btn pagination__btn--prev" data-page="prev" ${this._currentPage === 1 ? "disabled" : ""}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="15 18 9 12 15 6"/>
                </svg>
                Previous
            </button>
            
            <div class="pagination__info">
                Page ${this._currentPage} of ${totalPages}
            </div>
            
            <button class="pagination__btn pagination__btn--next" data-page="next" ${this._currentPage === totalPages ? "disabled" : ""}>
                Next
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </button>
        `;
    }

    _goToPage(page) {
        const totalPages = Math.ceil(this._filteredArtists.length / this._perPage);
        if (page < 1 || page > totalPages)
            return;

        this._currentPage = page;
        this._renderArtists();

        this.container.querySelector("#artists-grid")?.scrollIntoView({ behavior: "smooth" });
    }

    _updateStats() {
        const countEl = this.container.querySelector("#artists-count");
        if (countEl) {
            countEl.textContent = `${formatNumber(this._artists.length)} artists`;
        }
    }

    _showLoading() {
        const container = this.container.querySelector("#artists-grid");
        if (container) {
            container.innerHTML = this._getLoadingSkeleton();
        }
    }

    _showError() {
        const container = this.container.querySelector("#artists-grid");
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state__icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                    </div>
                    <div class="empty-state__title">Failed to load artists</div>
                </div>
            `;
        }
    }

    _getLoadingSkeleton() {
        return Array(6).fill(null).map(() => `
            <div class="artist-card-lg artist-card-lg--skeleton">
                <div class="artist-card-lg__header">
                    <div class="skeleton" style="width: 32px; height: 32px; border-radius: 8px;"></div>
                    <div class="skeleton" style="width: 64px; height: 64px; border-radius: 50%;"></div>
                    <div>
                        <div class="skeleton" style="width: 140px; height: 18px; margin-bottom: 8px;"></div>
                        <div class="skeleton" style="width: 100px; height: 14px;"></div>
                    </div>
                </div>
                <div class="artist-card-lg__stats">
                    <div>
                        <div class="skeleton" style="width: 60px; height: 24px; margin-bottom: 4px;"></div>
                        <div class="skeleton" style="width: 80px; height: 12px;"></div>
                    </div>
                    <div>
                        <div class="skeleton" style="width: 50px; height: 24px; margin-bottom: 4px;"></div>
                        <div class="skeleton" style="width: 70px; height: 12px;"></div>
                    </div>
                </div>
            </div>
        `).join("");
    }

    _getEmptyState() {
        return `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                </div>
                <div class="empty-state__title">No artists found</div>
                <div class="empty-state__text">
                    ${this._searchQuery ? "Try a different search term" : "Start listening on SoundCloud!"}
                </div>
            </div>
        `;
    }

    async _sendMessage(type, data = {}) {
        const response = await chrome.runtime.sendMessage({ type, data });
        if (response?.error)
            throw new Error(response.error);

        return response;
    }

    _getSmallArtwork(url) {
        if (!url)
            return "";

        return url.replace("-t500x500", "-t200x200").replace("-large", "-t200x200");
    }

    _escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text; return div.innerHTML;
    }

    destroy() { }
}