import { TIME, STORAGE_KEYS } from "../shared/constants.js";
import { storageManager } from "./storage-manager.js";
import { apiClient } from "./api-client.js";
import storageSync from "../shared/storage/sync.js";

class Tracker {
    constructor() {
        this._state = {
            isPlaying: false,
            currentTrack: null,
            sessionStart: 0,
            sessionSeconds: 0,
            lastTickTime: 0,
        };

        this._tickInterval = null;
        this._saveInterval = null;

        this._enabled = true;
        this._activeTabs = new Map();

        this._initialized = false;
    }

    async init() {
        if (this._initialized)
            return;

        const settings = await storageSync.get(STORAGE_KEYS.SETTINGS, {});
        this._enabled = settings.trackingEnabled !== false;

        const savedState = await storageSync.get(STORAGE_KEYS.CURRENT_TRACK, null);
        if (savedState) {
            this._state = { ...this._state, ...savedState };
        }

        this._startTicking();
        this._startPeriodicSave();

        this._initialized = true;
    }

    _startTicking() {
        if (this._tickInterval)
            return;

        this._tickInterval = setInterval(() => {
            this._tick();
        }, TIME.TRACKING_INTERVAL);
    }

    _stopTicking() {
        if (this._tickInterval) {
            clearInterval(this._tickInterval);
            this._tickInterval = null;
        }
    }

    _startPeriodicSave() {
        if (this._saveInterval)
            return;

        this._saveInterval = setInterval(async () => {
            await this._saveState();
        }, TIME.SAVE_INTERVAL);
    }

    async _tick() {
        if (!this._enabled || !this._state.isPlaying || !this._state.currentTrack) {
            return;
        }

        const now = Date.now();
        let elapsed = 1;

        if (this._state.lastTickTime) {
            const timeSinceLastTick = (now - this._state.lastTickTime) / 1000;
            if (timeSinceLastTick <= 2) {
                elapsed = Math.min(Math.round(timeSinceLastTick), 2);
            }
        }

        this._state.lastTickTime = now;
        this._state.sessionSeconds += elapsed;

        await storageManager.addListeningTime(this._state.currentTrack.id, elapsed);
    }

    async _saveState() {
        if (!this._state.currentTrack)
            return;

        await storageSync.set(STORAGE_KEYS.CURRENT_TRACK, {
            isPlaying: this._state.isPlaying,
            currentTrack: this._state.currentTrack,
            sessionStart: this._state.sessionStart,
            sessionSeconds: this._state.sessionSeconds,
        });
    }

    async handleTrackPlaying(data) {
        const { track, tabId } = data;
        if (!track || !track.id) {
            console.warn("[Tracker] Invalid track data");
            return;
        }

        this._activeTabs.set(tabId, { track, isPlaying: true });
        const isNewTrack = !this._state.currentTrack || this._state.currentTrack.id !== track.id;

        if (isNewTrack) {
            if (this._state.currentTrack && this._state.sessionSeconds > 0) {
                await this._endSession();
            }

            this._state.currentTrack = track;
            this._state.sessionStart = Date.now();
            this._state.sessionSeconds = 0;
            this._state.lastTickTime = Date.now();

            await storageManager.saveTrackInfo(track);
            await storageManager.markTrackPlayed(track.id);

            this._enrichTrackInfo(track.id);
        }

        this._state.isPlaying = true;
        this._state.lastTickTime = Date.now();

        await this._tick();
    }

    async handleTrackPaused(data) {
        const { tabId } = data;
        const tabState = this._activeTabs.get(tabId);

        if (tabState) {
            tabState.isPlaying = false;
        }

        const anyPlaying = Array.from(this._activeTabs.values()).some(t => t.isPlaying);
        if (!anyPlaying) {
            this._state.isPlaying = false;
            await this._saveState();
        }
    }

    async handleTrackChanged(data) {
        if (this._state.currentTrack && this._state.sessionSeconds > 0) {
            await this._endSession();
        }

        await this.handleTrackPlaying(data);
    }

    async handleTrackEnded(data) {
        const { tabId } = data;

        if (this._state.currentTrack && this._state.sessionSeconds > 0) {
            const trackDuration = this._state.currentTrack.duration / 1000;
            const completed = this._state.sessionSeconds >= trackDuration * 0.9;

            await this._endSession(completed);
        }

        const tabState = this._activeTabs.get(tabId);
        if (tabState) {
            tabState.isPlaying = false;
        }

        this._state.isPlaying = false;
    }

    async handleTabClosed(tabId) {
        const tabState = this._activeTabs.get(tabId);
        this._activeTabs.delete(tabId);

        if (tabState?.isPlaying) {
            await this.handleTrackPaused({ tabId });
        }
    }

    async _endSession(completed = false) {
        if (!this._state.currentTrack || this._state.sessionSeconds < 1)
            return;

        await storageManager.recordSession(
            this._state.currentTrack.id,
            this._state.sessionSeconds,
            completed
        );

        this._state.sessionSeconds = 0;
        this._state.sessionStart = 0;
    }

    async _enrichTrackInfo(trackId) {
        try {
            const fullInfo = await apiClient.getTrack(trackId);
            if (fullInfo && this._state.currentTrack?.id === trackId) {
                this._state.currentTrack = { ...this._state.currentTrack, ...fullInfo };
                await storageManager.saveTrackInfo(this._state.currentTrack);
            }
        } catch (error) { }
    }

    getStatus() {
        return {
            isPlaying: this._state.isPlaying,
            currentTrack: this._state.currentTrack,
            sessionSeconds: this._state.sessionSeconds,
            enabled: this._enabled,
        };
    }

    async setEnabled(enabled) {
        this._enabled = enabled;

        const settings = await storageSync.get(STORAGE_KEYS.SETTINGS, {}); settings.trackingEnabled = enabled;
        await storageSync.set(STORAGE_KEYS.SETTINGS, settings, true);

        if (!enabled && this._state.isPlaying) {
            await this._endSession();
            this._state.isPlaying = false;
        }

        console.log("[Tracker] Enabled:", enabled);
    }

    async cleanup() {
        this._stopTicking();

        if (this._saveInterval) {
            clearInterval(this._saveInterval);
            this._saveInterval = null;
        }

        if (this._state.currentTrack && this._state.sessionSeconds > 0) {
            await this._endSession();
        }

        await storageManager.flush();
        console.log("[Tracker] Cleanup complete");
    }
}

export const tracker = new Tracker();
export default tracker;