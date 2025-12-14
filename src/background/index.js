import { MESSAGES, STORAGE_KEYS } from "../shared/constants.js";
import { tracker } from "./tracker.js";
import { storageManager } from "./storage-manager.js";
import { apiClient } from "./api-client.js";
import { runMigrations } from "../shared/storage/migrations.js";
import storageSync from "../shared/storage/sync.js";

async function initialize() {
    try {
        await runMigrations();
        await storageManager.init();
        await apiClient.init();
        await tracker.init();
    } catch (error) {
        console.error("[CloudTrail] Initialization failed:", error);
    }
}; initialize();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender)
        .then(sendResponse)
        .catch(error => {
            console.error("[CloudTrail] Message handler error:", error);
            sendResponse({ error: error.message });
        });

    return true;
});

async function handleMessage(message, sender) {
    const { type, data } = message;
    const tabId = sender.tab?.id;

    switch (type) {
        case MESSAGES.TRACK_PLAYING:
            await tracker.handleTrackPlaying({ ...data, tabId });
            return { success: true };
        case MESSAGES.TRACK_PAUSED:
            await tracker.handleTrackPaused({ tabId });
            return { success: true };
        case MESSAGES.TRACK_CHANGED:
            await tracker.handleTrackChanged({ ...data, tabId });
            return { success: true };
        case MESSAGES.TRACK_ENDED:
            await tracker.handleTrackEnded({ tabId });
            return { success: true };
        case MESSAGES.GET_STATUS:
            return tracker.getStatus();
        case MESSAGES.GET_STATS:
            const period = data?.period || "all";
            return await storageManager.getTotalStats(period);
        case MESSAGES.GET_TOP_TRACKS:
            return await storageManager.getTopTracks({
                sortBy: data?.sortBy || "playCount",
                limit: data?.limit || 10,
                period: data?.period || "all",
            });
        case MESSAGES.GET_TRACK_DETAILS:
            const trackStats = storageManager.getTrackStats(data.trackId);
            const trackInfo = await storageManager.getTrackInfo(data.trackId);

            return { ...trackStats, track: trackInfo };
        case MESSAGES.GET_DAILY_STATS:
            return storageManager.getDailyStatsForPeriod(data?.period || "month");
        case MESSAGES.GET_SETTINGS:
            return await storageSync.get(STORAGE_KEYS.SETTINGS, {});
        case MESSAGES.UPDATE_SETTINGS:
            const currentSettings = await storageSync.get(STORAGE_KEYS.SETTINGS, {});
            const newSettings = { ...currentSettings, ...data };

            await storageSync.set(STORAGE_KEYS.SETTINGS, newSettings, true);

            if (data.trackingEnabled !== undefined) {
                await tracker.setEnabled(data.trackingEnabled);
            }

            return newSettings;
        case MESSAGES.CLIENT_ID_FOUND:
            await apiClient.setClientId(data.clientId);
            return { success: true };
        case MESSAGES.API_REQUEST:
            return await handleAPIRequest(data);
        case MESSAGES.EXPORT_DATA:
            return await exportAllData();
        case MESSAGES.IMPORT_DATA:
            return await importData(data);
        case MESSAGES.GENERATE_WRAPPED:
            return await generateWrapped(data?.year);
        case MESSAGES.HEARTBEAT:
            return { alive: true, timestamp: Date.now() };
        default:
            console.warn("[CloudTrail] Unknown message type:", type);
            return { error: "Unknown message type" };
    }
}

async function handleAPIRequest(data) {
    const { method, params } = data;

    switch (method) {
        case "getTrack":
            return await apiClient.getTrack(params.trackId);
        case "getTracks":
            return await apiClient.getTracks(params.trackIds);
        case "resolve":
            return await apiClient.resolve(params.url);
        case "getMyLikes":
            return await apiClient.getMyLikes(params);
        case "importLikes":
            return await apiClient.importLikedTracks();
        case "getArtist":
            return await apiClient.getArtist(params.artistId);
        case "isReady":
            return { ready: apiClient.isReady() };
        default:
            throw new Error("Unknown API method: " + method);
    }
}

async function exportAllData() {
    const data = await chrome.storage.local.get(null);
    const exportData = {};

    for (const [key, value] of Object.entries(data)) {
        if (key.startsWith("ct_")) {
            exportData[key] = value;
        }
    }

    return {
        version: 1,
        exportedAt: new Date().toISOString(),
        data: exportData,
    };
}

async function importData(backup) {
    if (!backup || !backup.data) {
        throw new Error("Invalid backup format");
    }

    await chrome.storage.local.set(backup.data);
    await storageManager.init();

    return { success: true, imported: Object.keys(backup.data).length };
}

async function generateWrapped(year = new Date().getFullYear()) {
    const allTracks = await storageManager.getTopTracks({
        sortBy: "playCount",
        limit: 100,
        period: "year",
    });

    let totalSeconds = 0;
    let totalPlays = 0;

    const artistMap = new Map();
    for (const trackData of allTracks) {
        totalSeconds += trackData.totalSeconds || 0;
        totalPlays += trackData.playCount || 0;

        if (trackData.track?.artistId) {
            const artistId = trackData.track.artistId;
            const existing = artistMap.get(artistId) || {
                id: artistId,
                name: trackData.track.artistName,
                avatarUrl: null,
                totalSeconds: 0,
                playCount: 0,
                trackCount: 0,
            };

            existing.totalSeconds += trackData.totalSeconds || 0;
            existing.playCount += trackData.playCount || 0;
            existing.trackCount++;
            artistMap.set(artistId, existing);
        }
    }

    const patterns = await storageManager.getListeningPatterns(year);

    const peakHour = Object.entries(patterns.byHour).sort((a, b) => b[1] - a[1])[0]?.[0];
    const peakDay = Object.entries(patterns.byDayOfWeek).sort((a, b) => b[1] - a[1])[0]?.[0];
    const peakMonth = Object.entries(patterns.byMonth).sort((a, b) => b[1] - a[1])[0]?.[0];

    const wrappedData = {
        year,
        generatedAt: Date.now(),
        summary: {
            totalSeconds,
            totalTracks: allTracks.length,
            totalArtists: artistMap.size,
            totalPlays,
            mostActiveHour: peakHour ? parseInt(peakHour) : null,
            mostActiveDay: peakDay ? parseInt(peakDay) : null,
            mostActiveMonth: peakMonth ? parseInt(peakMonth) : null,
        },
        topTracks: allTracks.slice(0, 10).map(t => ({
            id: t.trackId,
            title: t.track?.title || "Unknown",
            artist: t.track?.artistName || "Unknown",
            artworkUrl: t.track?.artworkUrl,
            playCount: t.playCount,
            totalSeconds: t.totalSeconds,
        })),
        topArtists: Array.from(artistMap.values())
            .sort((a, b) => b.totalSeconds - a.totalSeconds)
            .slice(0, 10),
        patterns,
    };

    const allWrapped = await storageSync.get(STORAGE_KEYS.WRAPPED_DATA, {});
    allWrapped[year] = wrappedData;

    await storageSync.set(STORAGE_KEYS.WRAPPED_DATA, allWrapped, true);
    return wrappedData;
}

chrome.tabs.onRemoved.addListener((tabId) => {
    tracker.handleTabClosed(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        if (!changeInfo.url.includes("soundcloud.com")) {
            tracker.handleTabClosed(tabId);
        }
    }
});

chrome.alarms.create("periodicSync", {
    periodInMinutes: 5
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "periodicSync") {
        await storageManager.flush();
    }
});

chrome.runtime.onInstalled.addListener(async (details) => {
    console.log("[CloudTrail] Installed/Updated:", details.reason);

    if (details.reason === "install") {
        console.log("[CloudTrail] Welcome to CloudTrail!");
    }

    if (details.reason === "update") {
        await runMigrations();
    }
});

export { handleMessage, generateWrapped };