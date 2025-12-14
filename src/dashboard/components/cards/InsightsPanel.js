import { formatDuration } from "../../../shared/utils/time.js";
import { formatNumber } from "../../../shared/i18n/index.js";

export class InsightsPanel {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this._insights = [];
    }

    generate(data) {
        this._insights = [];
        const { stats, dailyStats, topTracks } = data;

        if (dailyStats?.length > 0) {
            const peakDay = [...dailyStats].sort((a, b) =>
                (b.totalSeconds || 0) - (a.totalSeconds || 0)
            )[0];

            if (peakDay) {
                const date = new Date(peakDay.date);
                this._insights.push({
                    icon: "calendar",
                    title: "Peak Day",
                    value: date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
                    subvalue: formatDuration(peakDay.totalSeconds || 0, { showSeconds: false }),
                });
            }
        }

        if (topTracks?.length > 0) {
            const top = topTracks[0];
            this._insights.push({
                icon: "music",
                title: "Most Played",
                value: top.track?.title || "Unknown",
                subvalue: `${formatNumber(top.playCount)} plays`,
            });
        }

        if (stats?.totalSeconds && dailyStats?.length > 0) {
            const activeDays = dailyStats.filter(d => d.totalSeconds > 0).length;
            if (activeDays > 0) {
                const avgPerDay = Math.round(stats.totalSeconds / activeDays);
                this._insights.push({
                    icon: "clock",
                    title: "Daily Average",
                    value: formatDuration(avgPerDay, { showSeconds: false }),
                    subvalue: `across ${activeDays} active days`,
                });
            }
        }

        if (dailyStats?.length > 0) {
            const streak = this._calculateStreak(dailyStats);
            if (streak > 1) {
                this._insights.push({
                    icon: "flame",
                    title: "Current Streak",
                    value: `${streak} days`,
                    subvalue: "Keep it going!",
                });
            }
        }

        this.render();
    }

    _calculateStreak(dailyStats) {
        const sorted = [...dailyStats].sort((a, b) =>
            new Date(b.date) - new Date(a.date)
        );

        let streak = 0;
        const today = new Date(); today.setHours(0, 0, 0, 0);

        for (let i = 0; i < sorted.length; i++) {
            const date = new Date(sorted[i].date); date.setHours(0, 0, 0, 0);
            const expectedDate = new Date(today); expectedDate.setDate(expectedDate.getDate() - i);

            if (date.getTime() === expectedDate.getTime() && sorted[i].totalSeconds > 0) {
                streak++;
            } else {
                break;
            }
        }

        return streak;
    }

    render() {
        if (!this.container)
            return;

        if (this._insights.length === 0) {
            this.container.innerHTML = "";
            return;
        }

        this.container.innerHTML = `
            <div class="insights-panel">
                <h3 class="insights-panel__title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                    </svg>
                    Insights
                </h3>

                ${this._insights.map(insight => `
                    <div class="insight-item">
                        <div class="insight-item__icon">
                            ${this._getIcon(insight.icon)}
                        </div>
                        <div class="insight-item__content">
                            <div class="insight-item__title">${insight.title}</div>
                            <div class="insight-item__value">${insight.value}</div>

                            ${
                                insight.subvalue ? `<div class="insight-item__subvalue" style="font-size: 11px; color: var(--ct-text-tertiary); margin-top: 2px;">
                                ${insight.subvalue}
                                </div>` : ""
                            }
                        </div>
                    </div>
                `).join("")}
            </div>
        `;
    }

    _getIcon(name) {
        const icons = {
            calendar: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
            `,
            music: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18V5l12-2v13"/>
                    <circle cx="6" cy="18" r="3"/>
                    <circle cx="18" cy="16" r="3"/>
                </svg>
            `,
            clock: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                </svg>
            `,
            flame: `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
                </svg>
            `,
        };

        return icons[name] || icons.clock;
    }
}