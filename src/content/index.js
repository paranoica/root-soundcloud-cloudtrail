import { MESSAGES } from "../shared/constants.js";
import { playerObserver } from "./player-observer.js";
import { apiInterceptor } from "./api-interceptor.js";
import { domExtractor } from "./dom-extractor.js";

function initialize() {
    if (!window.location.hostname.includes("soundcloud.com")) {
        return;
    }

    if (window.self !== window.top) {
        return;
    }

    playerObserver.init();

    setupHeartbeat();
    setupVisibilityHandler();
    setupNavigationHandler();
}

let heartbeatInterval = null;

function setupHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }

    heartbeatInterval = setInterval(async () => {
        try {
            await chrome.runtime.sendMessage({
                type: MESSAGES.HEARTBEAT,
                data: { timestamp: Date.now() },
            });
        } catch (error) { }
    }, 25000);

    chrome.runtime.sendMessage({
        type: MESSAGES.HEARTBEAT,
        data: { timestamp: Date.now() },
    }).catch(() => { });
}

function setupVisibilityHandler() {
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            const state = playerObserver.getState();
            if (state.isPlaying && state.currentTrack) {
                chrome.runtime.sendMessage({
                    type: MESSAGES.TRACK_PLAYING,
                    data: { track: state.currentTrack },
                }).catch(() => { });
            }
        }
    });
}

function setupNavigationHandler() {
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            onUrlChange();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    window.addEventListener("popstate", () => {
        setTimeout(onUrlChange, 100);
    });
}

function onUrlChange() {
    setTimeout(() => { }, 500);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleBackgroundMessage(message)
        .then(sendResponse)
        .catch(error => {
            console.error("[CloudTrail] Message error:", error);
            sendResponse({ error: error.message });
        });

    return true;
});

async function handleBackgroundMessage(message) {
    const { type, data } = message;

    switch (type) {
        case "GET_CURRENT_TRACK":
            return playerObserver.getState();
        case "GET_PAGE_TRACKS":
            return domExtractor.extractPageTracks();
        case "CHECK_CLIENT_ID":
            return { clientId: apiInterceptor.getClientId() };
        default:
            return { error: "Unknown message type" };
    }
}

function cleanup() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }

    playerObserver.destroy();
}

window.addEventListener("beforeunload", cleanup);
window.addEventListener("unload", cleanup);

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
} else {
    initialize();
}

window.addEventListener("load", () => {
    if (!playerObserver._initialized) {
        initialize();
    }
});