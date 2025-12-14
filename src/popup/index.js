import { MESSAGES } from "../shared/constants.js";
import { initI18n } from "../shared/i18n/index.js";
import { createStatsDisplay } from "./components/StatsCard.js";
import { createTopTracks } from "./components/TopTracks.js";
import { createTimeFilter, mapPeriod } from "./components/TimeFilter.js";
import { createQuickActions } from "./components/QuickActions.js";
import { createNowPlaying } from "./components/NowPlaying.js";

let components = {};
let updateInterval = null;
let currentPeriod = "today";

async function initialize() {
    await initI18n();
    initializeComponents();

    await loadData();
    startPeriodicUpdates();
}

function initializeComponents() {
    components.stats = createStatsDisplay();

    const tracksContainer = document.getElementById("top-tracks-list"); components.topTracks = createTopTracks(tracksContainer);
    const filterContainer = document.getElementById("time-filter");

    components.timeFilter = createTimeFilter(filterContainer, onPeriodChange);
    components.nowPlaying = createNowPlaying();

    components.quickActions = createQuickActions();
    components.statusText = document.getElementById("status-text");
}

async function loadData() {
    try {
        components.stats.showLoading();
        components.topTracks.showLoading();

        const status = await sendMessage(MESSAGES.GET_STATUS); updateStatus(status);
        const [stats, topTracks] = await Promise.all([
            sendMessage(MESSAGES.GET_STATS, { period: mapPeriod(currentPeriod) }),
            sendMessage(MESSAGES.GET_TOP_TRACKS, {
                period: mapPeriod(currentPeriod),
                limit: 5,
                sortBy: "playCount",
            }),
        ]);

        components.stats.hideLoading();
        components.stats.update(stats);

        components.topTracks.render(topTracks);
    } catch (error) {
        console.error("[Popup] Failed to load data:", error);
        showError();
    }
}

function updateStatus(status) {
    components.nowPlaying.update(status);

    if (components.statusText) {
        if (status.isPlaying) {
            components.statusText.textContent = "Tracking active";
            components.statusText.classList.remove("inactive");
        } else if (status.currentTrack) {
            components.statusText.textContent = "Paused";
            components.statusText.classList.add("inactive");
        } else {
            components.statusText.textContent = status.enabled ? "Waiting for playback" : "Tracking disabled";
            components.statusText.classList.add("inactive");
        }
    }
}

async function onPeriodChange(period) {
    currentPeriod = period;

    components.stats.showLoading();
    components.topTracks.showLoading();

    try {
        const [stats, topTracks] = await Promise.all([
            sendMessage(MESSAGES.GET_STATS, { period: mapPeriod(period) }),
            sendMessage(MESSAGES.GET_TOP_TRACKS, {
                period: mapPeriod(period),
                limit: 5,
                sortBy: "playCount",
            }),
        ]);

        components.stats.hideLoading();
        components.stats.update(stats);

        components.topTracks.render(topTracks);
    } catch (error) {
        console.error("[Popup] Failed to load period data:", error);
    }
}

function startPeriodicUpdates() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }

    updateInterval = setInterval(async () => {
        try {
            const status = await sendMessage(MESSAGES.GET_STATUS); updateStatus(status);
            if (status.isPlaying) {
                const stats = await sendMessage(MESSAGES.GET_STATS, {
                    period: mapPeriod(currentPeriod)
                });

                components.stats.update(stats);
            }
        } catch (error) { }
    }, 2000);
}

function stopPeriodicUpdates() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

function showError() {
    components.stats.hideLoading();
    components.stats.update({
        totalSeconds: 0,
        totalTracks: 0,
        totalArtists: 0,
    });

    components.topTracks.render([]);
}

async function sendMessage(type, data = {}) {
    try {
        const response = await chrome.runtime.sendMessage({ type, data });
        if (response?.error) {
            throw new Error(response.error);
        }

        return response;
    } catch (error) {
        console.error(`[Popup] Message ${type} failed:`, error);
        throw error;
    }
}

document.addEventListener("DOMContentLoaded", initialize);
window.addEventListener("unload", () => {
    stopPeriodicUpdates();
});

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        loadData();
        startPeriodicUpdates();
    } else {
        stopPeriodicUpdates();
    }
});