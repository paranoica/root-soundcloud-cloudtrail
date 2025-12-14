import { STORAGE_KEYS } from "../shared/constants.js";
import { storageManager } from "./storage-manager.js";
import { apiClient } from "./api-client.js";
import storageSync from "../shared/storage/sync.js";

class Tracker {
    constructor() {
        this._state = {
            isPlaying: false,
            currentTrack: null,
            sessionSeconds: 0,
            lastTickTime: 0,
            hasCountedPlay: false,
            sessionFinished: false
        };
        this._tickInterval = null;
        this._saveInterval = null;
        this._enabled = true;
        this._initialized = false;
    }

    async init() {
        if (this._initialized)
            return;

        const settings = await storageSync.get(STORAGE_KEYS.SETTINGS, {});
        this._enabled = settings.trackingEnabled !== false;

        const saved = await storageSync.get(STORAGE_KEYS.CURRENT_TRACK, null);
        if (saved && saved.currentTrack) {
            this._state.currentTrack = saved.currentTrack;
        }

        this._startPeriodicSave();
        this._initialized = true;
    }

    _startTicking() {
        if (this._tickInterval)
            clearInterval(this._tickInterval);

        this._state.lastTickTime = Date.now();
        this._tickInterval = setInterval(() => this._tick(), 1000);
    }

    _stopTicking() {
        if (this._tickInterval) {
            clearInterval(this._tickInterval);
            this._tickInterval = null;
        }
    }

    async _tick() {
        if (!this._enabled || !this._state.isPlaying || !this._state.currentTrack)
            return;

        const now = Date.now();
        const deltaSeconds = (now - this._state.lastTickTime) / 1000;

        this._state.lastTickTime = now;

        if (deltaSeconds > 0 && deltaSeconds < 10) {
            this._state.sessionSeconds += deltaSeconds;

            await storageManager.addListeningTime(this._state.currentTrack.id, deltaSeconds);
            if (!this._state.hasCountedPlay && this._state.sessionSeconds >= 30) {
                await this._triggerPlayCount();
            }
        }
    }

    async _triggerPlayCount() {
        if (this._state.currentTrack) {
            await storageManager.incrementPlayCount(this._state.currentTrack.id);
            this._state.hasCountedPlay = true;
        }
    }

    async handleTrackPlaying(data) {
        const { track, tabId } = data;
        if (!track || !track.id)
            return;

        const currentId = this._state.currentTrack ? String(this._state.currentTrack.id) : null;
        const newId = String(track.id);

        const isNewSession = (!this._state.currentTrack) ||
            (currentId !== newId) ||
            (this._state.sessionFinished);

        if (isNewSession) {
            if (this._state.currentTrack && this._state.sessionSeconds > 5) {
                await this._endSession();
            }

            this._state.currentTrack = track;
            this._state.sessionSeconds = 0;
            this._state.hasCountedPlay = false;
            this._state.sessionFinished = false;

            await storageManager.saveTrackInfo(track);
            this._enrichTrackInfo(track.id);
        }

        this._state.isPlaying = true;
        this._startTicking();
    }

    async handleTrackPaused() {
        this._state.isPlaying = false;
        this._stopTicking();

        await this._saveState();
    }

    async handleTrackChanged(data) {
        await this.handleTrackPlaying(data);
    }

    async handleTrackEnded() {
        this._state.isPlaying = false;
        this._stopTicking();
        this._state.sessionFinished = true;

        if (!this._state.hasCountedPlay && this._state.sessionSeconds > 10) {
            await this._triggerPlayCount();
        }

        await this._endSession(true);
    }

    async handleTabClosed(tabId) {
        if (this._state.isPlaying) {
            await this.handleTrackPaused();
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
    }

    async _enrichTrackInfo(trackId) {
        try {
            const fullInfo = await apiClient.getTrack(trackId);
            if (fullInfo && String(this._state.currentTrack?.id) === String(trackId)) {
                this._state.currentTrack = { ...this._state.currentTrack, ...fullInfo };
                await storageManager.saveTrackInfo(this._state.currentTrack);
            }
        } catch (error) { }
    }

    _startPeriodicSave() {
        if (this._saveInterval)
            clearInterval(this._saveInterval);

        this._saveInterval = setInterval(async () => await this._saveState(), 5000);
    }

    async _saveState() {
        if (!this._state.currentTrack)
            return;

        await storageSync.set(STORAGE_KEYS.CURRENT_TRACK, {
            isPlaying: this._state.isPlaying,
            currentTrack: this._state.currentTrack,
            sessionSeconds: this._state.sessionSeconds,
        });
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
        if (!enabled)
            this._stopTicking();

        const settings = await storageSync.get(STORAGE_KEYS.SETTINGS, {}); settings.trackingEnabled = enabled;
        await storageSync.set(STORAGE_KEYS.SETTINGS, settings, true);
    }

    async cleanup() {
        this._stopTicking(); clearInterval(this._saveInterval);
        await storageManager.flush();
    }
}

export const tracker = new Tracker();
export default tracker;