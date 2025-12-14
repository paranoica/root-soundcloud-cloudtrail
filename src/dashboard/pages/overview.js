import { MESSAGES } from "../../shared/constants.js";
import { formatDuration, getDateString } from "../../shared/utils/time.js";
import { formatNumber } from "../../shared/i18n/index.js";
import { ListeningChart } from "../components/charts/ListeningChart.js";
import { HeatmapCalendar } from "../components/charts/HeatmapCalendar.js";
import { HourlyChart } from "../components/charts/HourlyChart.js";

export class OverviewPage {
    constructor(options = {}) {
        this.container = options.container;
        this.period = options.period || "week";

        this._stats = null;
        this._topTracks = [];
        this._dailyStats = [];

        this._listeningChart = null;
        this._heatmap = null;
        this._hourlyChart = null;
    }

    async render() {
        this.container.innerHTML = this._getTemplate();
        await this.loadData(); this._initCharts();
    }

    async loadData() {
        try {
            const [stats, topTracks, dailyStats] = await Promise.all([
                this._sendMessage(MESSAGES.GET_STATS, { period: this.period }),
                this._sendMessage(MESSAGES.GET_TOP_TRACKS, {
                    period: this.period,
                    limit: 5,
                    sortBy: "playCount"
                }),
                this._sendMessage(MESSAGES.GET_DAILY_STATS, { period: "year" }),
            ]);

            this._stats = stats;
            this._topTracks = topTracks;
            this._dailyStats = dailyStats;

            this._updateStats();
            this._updateTopTracks();
            this._updateCharts();
        } catch (error) {
            console.error("[Overview] Load failed:", error);
        }
    }

    async updatePeriod(period) {
        this.period = period;
        await this.loadData();
    }

    _initCharts() {
        this._listeningChart = new ListeningChart("activity-chart", { type: "area" });
        this._listeningChart.init();

        this._heatmap = new HeatmapCalendar("activity-heatmap", { weeks: 26 });

        this._hourlyChart = new HourlyChart("hourly-chart");
        this._hourlyChart.init();
    }

    _updateCharts() {
        if (this._listeningChart && this._dailyStats) {
            const periodDays = this._getPeriodDays();
            const recentStats = this._dailyStats.slice(-periodDays);

            const labels = recentStats.map(d => {
                const date = new Date(d.date);
                return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            });

            const values = recentStats.map(d => Math.round((d.totalSeconds || 0) / 60));
            this._listeningChart.updateAnimated({ labels, values });
        }

        if (this._heatmap && this._dailyStats) {
            const heatmapData = {};
            this._dailyStats.forEach(d => {
                heatmapData[d.date] = d.totalSeconds || 0;
            });

            this._heatmap.update(heatmapData);
        }

        if (this._hourlyChart && this._dailyStats) {
            const hourlyAggregated = {};
            for (let i = 0; i < 24; i++)
                hourlyAggregated[i] = 0;

            this._dailyStats.forEach(d => {
                if (d.hourlySeconds) {
                    Object.entries(d.hourlySeconds).forEach(([hour, seconds]) => {
                        hourlyAggregated[parseInt(hour)] += seconds;
                    });
                }
            });

            this._hourlyChart.update(hourlyAggregated);
        }
    }

    _getPeriodDays() {
        switch (this.period) {
            case "week": return 7;
            case "month": return 30;
            case "year": return 365;
            default: return 30;
        }
    }

    _getTemplate() {
        return `
            <div class="overview-page">
                <div class="stats-row">
                    <div class="stat-card stat-card--gradient">
                        <div class="stat-card__header">
                            <div class="stat-card__icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <polyline points="12 6 12 12 16 14"/>
                                </svg>
                            </div>
                        </div>
                        <div class="stat-card__value" id="stat-time">--</div>
                        <div class="stat-card__label">Listening Time</div>
                    </div>
                
                    <div class="stat-card">
                        <div class="stat-card__header">
                            <div class="stat-card__icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M9 18V5l12-2v13"/>
                                    <circle cx="6" cy="18" r="3"/>
                                    <circle cx="18" cy="16" r="3"/>
                                </svg>
                            </div>
                        </div>
                        <div class="stat-card__value" id="stat-tracks">--</div>
                        <div class="stat-card__label">Tracks</div>
                    </div>
                
                    <div class="stat-card">
                        <div class="stat-card__header">
                            <div class="stat-card__icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                    <circle cx="9" cy="7" r="4"/>
                                </svg>
                            </div>
                        </div>
                        <div class="stat-card__value" id="stat-artists">--</div>
                        <div class="stat-card__label">Artists</div>
                    </div>
                
                    <div class="stat-card">
                        <div class="stat-card__header">
                            <div class="stat-card__icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polygon points="5 3 19 12 5 21 5 3"/>
                                </svg>
                            </div>
                        </div>
                        <div class="stat-card__value" id="stat-plays">--</div>
                        <div class="stat-card__label">Plays</div>
                    </div>
                </div>
                <div class="two-column">
                    <div class="chart-container">
                        <div class="chart-header">
                            <div>
                                <h3 class="chart-title">Listening Activity</h3>
                                <p class="chart-subtitle">Minutes listened per day</p>
                            </div>
                        </div>
                        <div class="chart-wrapper chart-wrapper--md">
                            <canvas id="activity-chart"></canvas>
                        </div>
                    </div>

                    <div class="chart-container">
                        <div class="chart-header">
                            <div>
                                <h3 class="chart-title">Peak Hours</h3>
                                <p class="chart-subtitle">When you listen most</p>
                            </div>
                        </div>
                        <div class="chart-wrapper chart-wrapper--md">
                            <canvas id="hourly-chart"></canvas>
                        </div>
                    </div>
                </div>

                <div class="chart-container">
                    <div class="chart-header">
                        <div>
                            <h3 class="chart-title">Activity Calendar</h3>
                            <p class="chart-subtitle">Your listening history over time</p>
                        </div>
                    </div>
                    <div id="activity-heatmap"></div>
                </div>

                <div class="page-section">
                    <div class="section-header">
                        <h3 class="section-title">Top Tracks</h3>
                        <a href="#/tracks" class="link-btn">View All</a>
                    </div>
                    <div class="tracks-grid" id="top-tracks-grid">
                        ${this._getTracksSkeleton()}
                    </div>
                </div>
            </div>
        `;
    }

    _updateStats() {
        const els = {
            time: document.getElementById("stat-time"),
            tracks: document.getElementById("stat-tracks"),
            artists: document.getElementById("stat-artists"),
            plays: document.getElementById("stat-plays"),
        };

        if (els.time) els.time.textContent = formatDuration(this._stats?.totalSeconds || 0, { showSeconds: false });
        if (els.tracks) els.tracks.textContent = formatNumber(this._stats?.totalTracks || 0);
        if (els.artists) els.artists.textContent = formatNumber(this._stats?.totalArtists || 0);
        if (els.plays) els.plays.textContent = formatNumber(this._stats?.totalPlays || 0);
    }

    _updateTopTracks() {
        const container = document.getElementById("top-tracks-grid");
        if (!container)
            return;

        if (!this._topTracks?.length) {
            container.innerHTML = this._getEmptyState();
            return;
        }

        container.innerHTML = this._topTracks.map((item, i) => `
            <div class="track-card" data-permalink="${item.track?.permalink || ""}">
                <div class="track-card__rank track-card__rank--${i + 1}">${i + 1}</div>
                <div class="track-card__artwork">
                    ${
                        item.track?.artworkUrl
                            ? `<img src="${item.track.artworkUrl.replace("-t500x500", "-t200x200")}" alt="" loading="lazy">`
                            : `<div class="track-card__artwork-placeholder"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>`
                    }
                </div>
                <div class="track-card__info">
                    <div class="track-card__title">${this._escapeHtml(item.track?.title || "Unknown")}</div>
                    <div class="track-card__artist">${this._escapeHtml(item.track?.artistName || "Unknown")}</div>
                </div>
                <div class="track-card__stats">
                    <div class="track-card__plays">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        ${formatNumber(item.playCount || 0)}
                    </div>
                    <div class="track-card__time">${formatDuration(item.totalSeconds || 0, { showSeconds: false })}</div>
                </div>
            </div>
        `).join("");

        container.querySelectorAll(".track-card").forEach(card => {
            card.addEventListener("click", () => {
                const permalink = card.dataset.permalink;
                if (permalink)
                    chrome.tabs.create({ url: `https://soundcloud.com/${permalink}` });
            });
        });
    }

    _getTracksSkeleton() {
        return Array(5).fill(null).map(() => `
            <div class="track-card">
                <div class="skeleton" style="width: 32px; height: 32px; border-radius: 8px;"></div>
                <div class="skeleton" style="width: 56px; height: 56px; border-radius: 12px;"></div>
                <div style="flex: 1;"><div class="skeleton" style="width: 70%; height: 16px; margin-bottom: 8px;"></div><div class="skeleton" style="width: 50%; height: 14px;"></div></div>
                <div class="skeleton" style="width: 50px; height: 24px;"></div>
            </div>
        `).join("");
    }

    _getEmptyState() {
        return `<div class="empty-state"><div class="empty-state__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div><div class="empty-state__title">No tracks yet</div><div class="empty-state__text">Start listening on SoundCloud!</div></div>`;
    }

    async _sendMessage(type, data = {}) {
        const response = await chrome.runtime.sendMessage({ type, data });
        if (response?.error) throw new Error(response.error);
        return response;
    }

    _escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text; return div.innerHTML;
    }

    destroy() {
        this._listeningChart?.destroy();
        this._heatmap?.destroy();
        this._hourlyChart?.destroy();
    }
}