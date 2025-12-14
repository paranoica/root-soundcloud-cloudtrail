import { formatDuration } from "../../shared/utils/time.js";
import { formatNumber } from "../../shared/i18n/index.js";

export function createStatsDisplay(stats) {
    const statTime = document.getElementById("stat-time");
    const statTracks = document.getElementById("stat-tracks");
    const statArtists = document.getElementById("stat-artists");

    return {
        statTime,
        statTracks,
        statArtists,

        update(newStats) {
            if (statTime) {
                const formattedTime = formatDuration(newStats.totalSeconds || 0, {
                    style: "short",
                    showSeconds: false,
                });

                animateValue(statTime, formattedTime);
            }

            if (statTracks) {
                animateValue(statTracks, formatNumber(newStats.totalTracks || 0));
            }

            if (statArtists) {
                animateValue(statArtists, formatNumber(newStats.totalArtists || 0));
            }
        },

        showLoading() {
            [statTime, statTracks, statArtists].forEach(el => {
                if (el) {
                    el.classList.add("skeleton");
                    el.textContent = "";
                }
            });
        },

        hideLoading() {
            [statTime, statTracks, statArtists].forEach(el => {
                if (el) {
                    el.classList.remove("skeleton");
                }
            });
        },
    };
}

function animateValue(element, newValue) {
    if (!element)
        return;

    const currentValue = element.textContent;
    if (currentValue === newValue)
        return;

    element.style.opacity = "0";
    element.style.transform = "translateY(10px)";

    setTimeout(() => {
        element.textContent = newValue;
        element.style.transition = "all 0.3s ease";
        element.style.opacity = "1";
        element.style.transform = "translateY(0)";
    }, 150);
}

export function createStatsSkeleton() {
    return `
        <div class="stats-grid">
            <div class="stat-card stat-card--primary">
                <div class="stat-card__icon skeleton" style="width: 56px; height: 56px;"></div>
                <div class="stat-card__content">
                <div class="skeleton" style="width: 120px; height: 32px; margin-bottom: 8px;"></div>
                <div class="skeleton" style="width: 80px; height: 14px;"></div>
                </div>
            </div>
            <div class="stat-card">
                <div class="skeleton" style="width: 40px; height: 40px; border-radius: 8px; margin-bottom: 12px;"></div>
                <div class="skeleton" style="width: 50px; height: 24px; margin-bottom: 4px;"></div>
                <div class="skeleton" style="width: 40px; height: 12px;"></div>
            </div>
            <div class="stat-card">
                <div class="skeleton" style="width: 40px; height: 40px; border-radius: 8px; margin-bottom: 12px;"></div>
                <div class="skeleton" style="width: 50px; height: 24px; margin-bottom: 4px;"></div>
                <div class="skeleton" style="width: 40px; height: 12px;"></div>
            </div>
        </div>
    `;
}