import { MESSAGES } from "../shared/constants.js";
import { initI18n } from "../shared/i18n/index.js";
import { Sidebar } from "./components/layout/Sidebar.js";
import { Header } from "./components/layout/Header.js";
import { Navigation } from "./components/layout/Navigation.js";

let components = {};
let currentPage = null;

const pageModules = {
    overview: () => import("./pages/overview.js"),
    tracks: () => import("./pages/tracks.js"),
    artists: () => import("./pages/artists.js"),
    wrapped: () => import("./pages/wrapped.js"),
    settings: () => import("./pages/settings.js"),
};

const pageTitles = {
    overview: "Overview",
    tracks: "Tracks",
    artists: "Artists",
    wrapped: "Wrapped",
    settings: "Settings",
};

async function initialize() {
    await initI18n();

    components.sidebar = new Sidebar();
    components.header = new Header({
        onPeriodChange: handlePeriodChange,
        onRefresh: handleRefresh,
    });

    components.navigation = new Navigation({
        onNavigate: handleNavigate,
    });

    updateStatus();
    setInterval(updateStatus, 5000);
}

async function handleNavigate(page) {
    components.sidebar.setActive(page);
    components.sidebar.close();

    components.header.setTitle(pageTitles[page] || "Dashboard");
    const showPeriod = ["overview", "tracks", "artists"].includes(page); components.header.showPeriodSelector(showPeriod);

    if (currentPage?.destroy) {
        currentPage.destroy();
    }

    const container = document.getElementById("page-content"); container.innerHTML = `
        <div class="loading-page">
            <div class="loading-spinner"></div>
            <p>Loading...</p>
        </div>
    `;

    try {
        const moduleLoader = pageModules[page];
        if (!moduleLoader) {
            throw new Error(`Unknown page: ${page}`);
        }

        const module = await moduleLoader();
        const PageClass = module[`${capitalize(page)}Page`] || module.default;

        if (!PageClass) {
            throw new Error(`Page class not found for: ${page}`);
        }

        currentPage = new PageClass({
            container,
            period: components.header.getPeriod(),
        });

        await currentPage.render();
    } catch (error) {
        console.error("[Dashboard] Page load failed:", error);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                </div>
                <div class="empty-state__title">Failed to load page</div>
                <div class="empty-state__text">${error.message}</div>
            </div>
        `;
    }
}

async function handlePeriodChange(period) {
    if (currentPage?.updatePeriod) {
        await currentPage.updatePeriod(period);
    }
}

async function handleRefresh() {
    if (currentPage?.loadData) {
        await currentPage.loadData();
    }
}

async function updateStatus() {
    try {
        const status = await chrome.runtime.sendMessage({
            type: MESSAGES.GET_STATUS,
        });

        const isActive = status.isPlaying;
        const text = isActive ? "Tracking Active" : status.enabled ? "Waiting for playback" : "Tracking Disabled";

        components.sidebar.updateStatus(isActive, text);
    } catch (error) { }
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

document.addEventListener("DOMContentLoaded", initialize);