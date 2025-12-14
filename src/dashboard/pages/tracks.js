import { MESSAGES } from "../../shared/constants.js";
import { formatDuration } from "../../shared/utils/time.js";
import { formatNumber, t } from "../../shared/i18n/index.js";
import { debounce } from "../../shared/utils/debounce.js";

export class TracksPage {
    constructor(options = {}) {
        this.container = options.container;
        this.period = options.period || "all";

        this._tracks = [];
        this._filteredTracks = [];
        this._sortBy = "playCount";
        this._sortOrder = "desc";
        this._searchQuery = "";
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
        this._showLoading(); try {
            const tracks = await this._sendMessage(MESSAGES.GET_TOP_TRACKS, {
                period: this.period,
                limit: 500,
                sortBy: this._sortBy,
            });

            this._tracks = tracks || [];
            this._applyFilters();
            this._renderTracks();
            this._updateStats();
        } catch (error) {
            console.error("[Tracks] Load failed:", error);
            this._showError();
        }
    }

    async updatePeriod(period) {
        this.period = period;
        this._currentPage = 1;

        await this.loadData();
    }

    _bindEvents() {
        const searchInput = this.container.querySelector("#tracks-search");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                this._searchQuery = e.target.value;
                this._debouncedSearch();
            });
        }

        const sortDropdown = this.container.querySelector("#sort-dropdown");
        if (sortDropdown) {
            sortDropdown.addEventListener("click", () => {
                sortDropdown.classList.toggle("open");
            });

            document.addEventListener("click", (e) => {
                if (!sortDropdown.contains(e.target)) {
                    sortDropdown.classList.remove("open");
                }
            });

            sortDropdown.querySelectorAll(".dropdown__item").forEach(item => {
                item.addEventListener("click", (e) => {
                    e.stopPropagation();

                    const sortBy = item.dataset.sort;
                    this._setSortBy(sortBy); sortDropdown.classList.remove("open");
                });
            });
        }

        this.container.addEventListener("click", (e) => {
            if (e.target.closest(".pagination__btn")) {
                const btn = e.target.closest(".pagination__btn");
                const page = btn.dataset.page;

                if (page === "prev") {
                    this._goToPage(this._currentPage - 1);
                } else if (page === "next") {
                    this._goToPage(this._currentPage + 1);
                } else {
                    this._goToPage(parseInt(page));
                }
            }
        });
    }

    _getTemplate() {
        return `
            <div class="tracks-page">
                <div class="page-toolbar">
                    <div class="page-toolbar__left">
                        <div class="search-input">
                            <svg class="search-input__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8"/>
                                <path d="M21 21l-4.35-4.35"/>
                            </svg>
                            <input
                                type="text" 
                                id="tracks-search" 
                                placeholder="Search tracks..."
                                autocomplete="off"
                            >
                        </div>

                        <div class="page-toolbar__stats">
                            <span id="tracks-count">0 tracks</span>
                            <span class="separator">•</span>
                            <span id="tracks-time">0h total</span>
                        </div>
                    </div>
                
                    <div class="page-toolbar__right">
                        <div class="dropdown" id="sort-dropdown">
                            <button class="dropdown__trigger">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 5h10M11 9h7M11 13h4M3 17l3 3 3-3M6 18V4"/>
                                </svg>
                                <span id="sort-label">Play Count</span>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="6 9 12 15 18 9"/>
                                </svg>
                            </button>
                            <div class="dropdown__menu">
                                <div class="dropdown__item active" data-sort="playCount">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polygon points="5 3 19 12 5 21 5 3"/>
                                    </svg>
                                    Play Count
                                </div>
                                <div class="dropdown__item" data-sort="totalSeconds">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"/>
                                        <polyline points="12 6 12 12 16 14"/>
                                    </svg>
                                    Listening Time
                                </div>
                                <div class="dropdown__item" data-sort="lastPlayedAt">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                        <line x1="16" y1="2" x2="16" y2="6"/>
                                        <line x1="8" y1="2" x2="8" y2="6"/>
                                        <line x1="3" y1="10" x2="21" y2="10"/>
                                    </svg>
                                    Recently Played
                                </div>
                                <div class="dropdown__item" data-sort="title">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M3 6h18M3 12h12M3 18h6"/>
                                    </svg>
                                    Alphabetical
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="tracks-list" id="tracks-list">
                    ${this._getLoadingSkeleton()}
                </div>

                <div class="pagination" id="pagination"></div>
            </div>
        `;
    }

    _performSearch() {
        this._currentPage = 1;
        this._applyFilters();
        this._renderTracks();
    }

    _applyFilters() {
        let filtered = [...this._tracks];
        if (this._searchQuery) {
            const query = this._searchQuery.toLowerCase(); filtered = filtered.filter(item => {
                const title = (item.track?.title || "").toLowerCase();
                const artist = (item.track?.artistName || "").toLowerCase();
                return title.includes(query) || artist.includes(query);
            });
        }

        filtered.sort((a, b) => {
            let aVal, bVal;

            switch (this._sortBy) {
                case "playCount":
                    aVal = a.playCount || 0;
                    bVal = b.playCount || 0;
                    break;
                case "totalSeconds":
                    aVal = a.totalSeconds || 0;
                    bVal = b.totalSeconds || 0;
                    break;
                case "lastPlayedAt":
                    aVal = a.lastPlayedAt || 0;
                    bVal = b.lastPlayedAt || 0;
                    break;
                case "title":
                    aVal = (a.track?.title || "").toLowerCase();
                    bVal = (b.track?.title || "").toLowerCase();
                    return this._sortOrder === "asc"
                        ? aVal.localeCompare(bVal)
                        : bVal.localeCompare(aVal);
                default:
                    aVal = a.playCount || 0;
                    bVal = b.playCount || 0;
            }

            return this._sortOrder === "asc" ? aVal - bVal : bVal - aVal;
        });

        this._filteredTracks = filtered;
    }

    _setSortBy(sortBy) {
        if (this._sortBy === sortBy) {
            this._sortOrder = this._sortOrder === "desc" ? "asc" : "desc";
        } else {
            this._sortBy = sortBy;
            this._sortOrder = sortBy === "title" ? "asc" : "desc";
        }

        const sortLabel = this.container.querySelector("#sort-label");
        const sortItems = this.container.querySelectorAll(".dropdown__item");

        const labels = {
            playCount: "Play Count",
            totalSeconds: "Listening Time",
            lastPlayedAt: "Recently Played",
            title: "Alphabetical",
        };

        if (sortLabel) {
            sortLabel.textContent = labels[sortBy] || "Play Count";
        }

        sortItems.forEach(item => {
            item.classList.toggle("active", item.dataset.sort === sortBy);
        });

        this._currentPage = 1;
        this._applyFilters();
        this._renderTracks();
    }

    _renderTracks() {
        const container = this.container.querySelector("#tracks-list");
        if (!container)
            return;

        if (this._filteredTracks.length === 0) {
            container.innerHTML = this._getEmptyState();
            this._renderPagination(); return;
        }

        const start = (this._currentPage - 1) * this._perPage;
        const end = start + this._perPage;

        const pageTracks = this._filteredTracks.slice(start, end); container.innerHTML = `
            <div class="tracks-table">
                <div class="tracks-table__header">
                    <div class="tracks-table__col tracks-table__col--rank">#</div>
                    <div class="tracks-table__col tracks-table__col--track">Track</div>
                    <div class="tracks-table__col tracks-table__col--plays">Plays</div>
                    <div class="tracks-table__col tracks-table__col--time">Time</div>
                    <div class="tracks-table__col tracks-table__col--last">Last Played</div>
                </div>
                <div class="tracks-table__body">
                    ${pageTracks.map((item, index) => this._renderTrackRow(item, start + index + 1)).join("")}
                </div>
            </div>
        `;

        container.querySelectorAll(".tracks-table__row").forEach(row => {
            row.addEventListener("click", () => {
                const permalink = row.dataset.permalink;
                if (permalink) {
                    chrome.tabs.create({ url: `https://soundcloud.com/${permalink}` });
                }
            });
        });

        this._renderPagination();
    }

    _renderTrackRow(item, rank) {
        const track = item.track || {};

        const artworkUrl = this._getSmallArtwork(track.artworkUrl);
        const lastPlayed = this._formatRelativeTime(item.lastPlayedAt);

        return `
            <div class="tracks-table__row" data-permalink="${track.permalink || ""}">
                <div class="tracks-table__col tracks-table__col--rank">
                    <span class="track-rank ${rank <= 3 ? "track-rank--" + rank : ""}">${rank}</span>
                </div>
                <div class="tracks-table__col tracks-table__col--track">
                    <div class="track-info">
                        <div class="track-info__artwork">
                            ${artworkUrl
                                ? `<img src="${artworkUrl}" alt="" loading="lazy">`
                                : `
                                    <div class="track-info__placeholder">
                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                                        </svg>
                                    </div>
                                `
                            }
                        </div>
                        <div class="track-info__text">
                            <div class="track-info__title">${this._escapeHtml(track.title || "Unknown")}</div>
                            <div class="track-info__artist">${this._escapeHtml(track.artistName || "Unknown")}</div>
                        </div>
                    </div>
                </div>
                <div class="tracks-table__col tracks-table__col--plays">
                    <span class="play-count">${formatNumber(item.playCount || 0)}</span>
                </div>
                <div class="tracks-table__col tracks-table__col--time">
                    <span class="listen-time">${formatDuration(item.totalSeconds || 0, { showSeconds: false })}</span>
                </div>
                <div class="tracks-table__col tracks-table__col--last">
                    <span class="last-played">${lastPlayed}</span>
                </div>
            </div>
        `;
    }

    _renderPagination() {
        const container = this.container.querySelector("#pagination");
        if (!container)
            return;

        const totalPages = Math.ceil(this._filteredTracks.length / this._perPage);
        if (totalPages <= 1) {
            container.innerHTML = "";
            return;
        }

        let pages = []; pages.push(1);
        for (let i = Math.max(2, this._currentPage - 1); i <= Math.min(totalPages - 1, this._currentPage + 1); i++) {
            if (!pages.includes(i)) {
                if (pages[pages.length - 1] !== i - 1) {
                    pages.push("...");
                }

                pages.push(i);
            }
        }

        if (totalPages > 1) {
            if (pages[pages.length - 1] !== totalPages - 1 && pages[pages.length - 1] !== "...") {
                pages.push("...");
            }

            if (!pages.includes(totalPages)) {
                pages.push(totalPages);
            }
        }

        container.innerHTML = `
            <button class="pagination__btn pagination__btn--prev" data-page="prev" ${this._currentPage === 1 ? "disabled" : ""}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="15 18 9 12 15 6"/>
                </svg>
                Previous
            </button>
            
            <div class="pagination__pages">
                ${pages.map(p => p === "..."
                    ? `<span class="pagination__ellipsis">...</span>`
                    : `<button class="pagination__btn pagination__btn--page ${p === this._currentPage ? "active" : ""}" data-page="${p}">${p}</button>`
                ).join("")}
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
        const totalPages = Math.ceil(this._filteredTracks.length / this._perPage);
        if (page < 1 || page > totalPages)
            return;

        this._currentPage = page;
        this._renderTracks();

        this.container.querySelector("#tracks-list")?.scrollIntoView({
            behavior: "smooth"
        });
    }

    _updateStats() {
        const countEl = this.container.querySelector("#tracks-count");
        const timeEl = this.container.querySelector("#tracks-time");

        if (countEl) {
            countEl.textContent = `${formatNumber(this._tracks.length)} tracks`;
        }

        if (timeEl) {
            const totalSeconds = this._tracks.reduce((sum, t) => sum + (t.totalSeconds || 0), 0);
            timeEl.textContent = `${formatDuration(totalSeconds, { showSeconds: false })} total`;
        }
    }

    _showLoading() {
        const container = this.container.querySelector("#tracks-list");
        if (container) {
            container.innerHTML = this._getLoadingSkeleton();
        }
    }

    _showError() {
        const container = this.container.querySelector("#tracks-list");
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
                    <div class="empty-state__title">Failed to load tracks</div>
                    <div class="empty-state__text">Please try refreshing the page</div>
                </div>
            `;
        }
    }

    _getLoadingSkeleton() {
        return `
            <div class="tracks-table">
                <div class="tracks-table__header">
                    <div class="tracks-table__col tracks-table__col--rank">#</div>
                    <div class="tracks-table__col tracks-table__col--track">Track</div>
                    <div class="tracks-table__col tracks-table__col--plays">Plays</div>
                    <div class="tracks-table__col tracks-table__col--time">Time</div>
                    <div class="tracks-table__col tracks-table__col--last">Last Played</div>
                </div>
                <div class="tracks-table__body">
                    ${Array(10).fill(null).map(() => `
                        <div class="tracks-table__row tracks-table__row--skeleton">
                            <div class="tracks-table__col tracks-table__col--rank">
                                <div class="skeleton" style="width: 24px; height: 24px;"></div>
                            </div>
                            <div class="tracks-table__col tracks-table__col--track">
                                <div class="track-info">
                                    <div class="skeleton" style="width: 48px; height: 48px; border-radius: 8px;"></div>
                                    <div class="track-info__text">
                                        <div class="skeleton" style="width: 180px; height: 16px; margin-bottom: 6px;"></div>
                                        <div class="skeleton" style="width: 120px; height: 14px;"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="tracks-table__col tracks-table__col--plays">
                                <div class="skeleton" style="width: 40px; height: 16px;"></div>
                            </div>
                            <div class="tracks-table__col tracks-table__col--time">
                                <div class="skeleton" style="width: 60px; height: 16px;"></div>
                            </div>
                            <div class="tracks-table__col tracks-table__col--last">
                                <div class="skeleton" style="width: 80px; height: 16px;"></div>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;
    }

    _getEmptyState() {
        const message = this._searchQuery
            ? "No tracks found matching your search"
            : "No tracks yet. Start listening on SoundCloud!";

        return `
            <div class="empty-state">
                <div class="empty-state__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 18V5l12-2v13"/>
                        <circle cx="6" cy="18" r="3"/>
                        <circle cx="18" cy="16" r="3"/>
                    </svg>
                </div>
                <div class="empty-state__title">No tracks found</div>
                <div class="empty-state__text">${message}</div>
            </div>
        `;
    }

    async _sendMessage(type, data = {}) {
        const response = await chrome.runtime.sendMessage({ type, data });
        if (response?.error)
            throw new Error(response.error);

        return response;
    }

    _formatRelativeTime(timestamp) {
        if (!timestamp)
            return "Never";

        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);

        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return "Just now";
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;

        return new Date(timestamp).toLocaleDateString();
    }

    _getSmallArtwork(url) {
        if (!url) return "";
        return url.replace("-t500x500", "-t200x200").replace("-large", "-t200x200");
    }

    _escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text; return div.innerHTML;
    }

    destroy() { }
}