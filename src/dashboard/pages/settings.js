import { MESSAGES, DEFAULT_SETTINGS } from "../../shared/constants.js";
import { getAvailableLanguages, setLanguage } from "../../shared/i18n/index.js";
import { showToast } from "../utils/toast.js";
import { readFileAsJSON } from "../../shared/utils/export.js";

export class SettingsPage {
    constructor(options = {}) {
        this.container = options.container;
        this._settings = { ...DEFAULT_SETTINGS };
    }

    async render() {
        this.container.innerHTML = this._getTemplate();
        await this._loadSettings(); this._bindEvents();
    }

    async _loadSettings() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: MESSAGES.GET_SETTINGS,
            });

            this._settings = { ...DEFAULT_SETTINGS, ...response };
            this._updateUI();
        } catch (error) {
            console.error("[Settings] Load failed:", error);
        }
    }

    _bindEvents() {
        const langSelect = this.container.querySelector("#setting-language");
        if (langSelect) {
            langSelect.addEventListener("change", (e) => {
                this._updateSetting("language", e.target.value);
                setLanguage(e.target.value);
            });
        }

        const themeSelect = this.container.querySelector("#setting-theme");
        if (themeSelect) {
            themeSelect.addEventListener("change", (e) => {
                this._updateSetting("theme", e.target.value);
                document.documentElement.setAttribute("data-theme", e.target.value);
            });
        }

        this.container.querySelectorAll(".toggle-switch input").forEach(input => {
            input.addEventListener("change", (e) => {
                this._updateSetting(e.target.dataset.setting, e.target.checked);
            });
        });

        const exportBtn = this.container.querySelector("#btn-export-data");
        if (exportBtn) {
            exportBtn.addEventListener("click", () => this._exportData());
        }

        const importBtn = this.container.querySelector("#btn-import-data");
        const importInput = this.container.querySelector("#import-file-input");

        if (importBtn && importInput) {
            importBtn.addEventListener("click", () => importInput.click());
            importInput.addEventListener("change", (e) => this._importData(e.target.files[0]));
        }

        const clearBtn = this.container.querySelector("#btn-clear-data");
        if (clearBtn) {
            clearBtn.addEventListener("click", () => this._clearData());
        }

        const clientIdInput = this.container.querySelector("#setting-client-id");
        const saveClientIdBtn = this.container.querySelector("#btn-save-client-id");

        if (clientIdInput && saveClientIdBtn) {
            saveClientIdBtn.addEventListener("click", () => {
                this._updateSetting("customClientId", clientIdInput.value.trim() || null);
                showToast("Client ID saved", "success");
            });
        }
    }

    async _updateSetting(key, value) {
        this._settings[key] = value;

        try {
            await chrome.runtime.sendMessage({
                type: MESSAGES.UPDATE_SETTINGS,
                data: { [key]: value },
            });
        } catch (error) {
            showToast("Failed to save setting", "error");
        }
    }

    _updateUI() {
        const langSelect = this.container.querySelector("#setting-language");
        if (langSelect) langSelect.value = this._settings.language || "en";

        const themeSelect = this.container.querySelector("#setting-theme");
        if (themeSelect) themeSelect.value = this._settings.theme || "dark";

        const trackingToggle = this.container.querySelector("[data-setting='trackingEnabled']");
        if (trackingToggle) trackingToggle.checked = this._settings.trackingEnabled !== false;

        const notifToggle = this.container.querySelector("[data-setting='showNotifications']");
        if (notifToggle) notifToggle.checked = this._settings.showNotifications === true;

        const clientIdInput = this.container.querySelector("#setting-client-id");
        if (clientIdInput) clientIdInput.value = this._settings.customClientId || "";
    }

    async _exportData() {
        const btn = this.container.querySelector("#btn-export-data");
        const originalText = btn.innerHTML;

        try {
            btn.disabled = true;
            btn.innerHTML = "<div class='loading-spinner loading-spinner--sm'></div> Exporting...";

            const response = await chrome.runtime.sendMessage({
                type: MESSAGES.EXPORT_DATA,
            });

            if (response.error)
                throw new Error(response.error);

            const dataStr = JSON.stringify(response, null, 2);

            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);

            const date = new Date().toISOString().split("T")[0];
            const link = document.createElement("a");

            link.href = url;
            link.download = `cloudtrail-backup-${date}.json`;

            document.body.appendChild(link);
            link.click();

            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showToast("Data exported successfully!", "success");
        } catch (error) {
            showToast("Export failed", "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    async _importData(file) {
        if (!file)
            return;

        try {
            const data = await readFileAsJSON(file);
            if (!data.data || !data.version) {
                throw new Error("Invalid backup file format");
            }

            if (!confirm("This will merge with your existing data. Continue?")) {
                return;
            }

            const response = await chrome.runtime.sendMessage({
                type: MESSAGES.IMPORT_DATA,
                data: data,
            });

            if (response.error)
                throw new Error(response.error);

            showToast("Data imported successfully!", "success");
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            showToast(`Import failed: ${error.message}`, "error");
        }

        this.container.querySelector("#import-file-input").value = "";
    }

    async _clearData() {
        const confirmed = confirm(
            "Are you sure you want to delete ALL your listening data?\n\n" +
            "This action cannot be undone. Consider exporting your data first."
        );

        if (!confirmed)
            return;

        const doubleConfirmed = confirm(
            "This is your last chance!\n\n" +
            "All your tracks, stats, and history will be permanently deleted."
        );

        if (!doubleConfirmed)
            return;

        try {
            const allData = await chrome.storage.local.get(null);
            const keysToRemove = Object.keys(allData).filter(key =>
                key.startsWith("ct_") && key !== "ct_settings"
            );

            await chrome.storage.local.remove(keysToRemove);

            showToast("All data has been cleared", "success");
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            showToast("Failed to clear data", "error");
        }
    }

    _getTemplate() {
        const languages = getAvailableLanguages();

        return `
            <div class="settings-page">
                <section class="settings-section">
                    <h2 class="settings-section__title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                        General
                    </h2>
                    
                    <div class="settings-group">
                        <div class="setting-item">
                            <div class="setting-item__info">
                                <label class="setting-item__label" for="setting-language">Language</label>
                                <p class="setting-item__desc">Choose your preferred language</p>
                            </div>
                            <select id="setting-language" class="setting-select">
                                ${languages.map(lang => `
                                        <option value="${lang.code}">${lang.nativeName}</option>
                                    `
                                ).join("")}
                            </select>
                        </div>
                        
                        <div class="setting-item">
                            <div class="setting-item__info">
                                <label class="setting-item__label" for="setting-theme">Theme</label>
                                <p class="setting-item__desc">Appearance of the dashboard</p>
                            </div>
                            <select id="setting-theme" class="setting-select">
                                <option value="dark">Dark</option>
                                <option value="light">Light</option>
                            </select>
                        </div>
                    </div>
                </section>

                <section class="settings-section">
                    <h2 class="settings-section__title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                        </svg>
                        Tracking
                    </h2>
                    
                    <div class="settings-group">
                        <div class="setting-item">
                            <div class="setting-item__info">
                                <label class="setting-item__label">Enable Tracking</label>
                                <p class="setting-item__desc">Count listening time while music plays</p>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" data-setting="trackingEnabled">
                                <span class="toggle-switch__slider"></span>
                            </label>
                        </div>
                        
                        <div class="setting-item">
                            <div class="setting-item__info">
                                <label class="setting-item__label">Notifications</label>
                                <p class="setting-item__desc">Show milestone notifications</p>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" data-setting="showNotifications">
                                <span class="toggle-switch__slider"></span>
                            </label>
                        </div>
                    </div>
                </section>

                <section class="settings-section">
                    <h2 class="settings-section__title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        Data Management
                    </h2>
                    
                    <div class="settings-group">
                        <div class="setting-item">
                            <div class="setting-item__info">
                                <label class="setting-item__label">Export Data</label>
                                <p class="setting-item__desc">Download all your listening data as JSON</p>
                            </div>
                            <button class="btn btn--secondary" id="btn-export-data">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="7 10 12 15 17 10"/>
                                    <line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                Export
                            </button>
                        </div>
                        
                        <div class="setting-item">
                            <div class="setting-item__info">
                                <label class="setting-item__label">Import Data</label>
                                <p class="setting-item__desc">Restore from a previous backup</p>
                            </div>
                            <input type="file" id="import-file-input" accept=".json" style="display: none;">
                            <button class="btn btn--secondary" id="btn-import-data">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="17 8 12 3 7 8"/>
                                    <line x1="12" y1="3" x2="12" y2="15"/>
                                </svg>
                                Import
                            </button>
                        </div>
                        
                        <div class="setting-item setting-item--danger">
                            <div class="setting-item__info">
                                <label class="setting-item__label">Clear All Data</label>
                                <p class="setting-item__desc">Permanently delete all listening history</p>
                            </div>
                            <button class="btn btn--danger" id="btn-clear-data">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                                Clear Data
                            </button>
                        </div>
                    </div>
                </section>

                <section class="settings-section">
                    <h2 class="settings-section__title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                            <path d="M2 17l10 5 10-5"/>
                            <path d="M2 12l10 5 10-5"/>
                        </svg>
                        SoundCloud API
                    </h2>
                    
                    <div class="settings-group">
                        <div class="setting-item setting-item--vertical">
                            <div class="setting-item__info">
                                <label class="setting-item__label">Client ID (Optional)</label>
                                <p class="setting-item__desc">
                                    CloudTrail automatically extracts the client ID from SoundCloud. 
                                    Only provide your own if you are experiencing issues.
                                </p>
                            </div>
                            <div class="setting-item__input-group">
                                <input 
                                    type="text" 
                                    id="setting-client-id" 
                                    class="setting-input"
                                    placeholder="Enter client ID..."
                                >
                                <button class="btn btn--secondary" id="btn-save-client-id">Save</button>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="settings-section">
                    <h2 class="settings-section__title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="16" x2="12" y2="12"/>
                            <line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        About
                    </h2>
                    
                    <div class="settings-group">
                        <div class="about-card">
                            <div class="about-card__logo">
                                <svg viewBox="0 0 32 32" fill="none">
                                    <path d="M16 4C9.373 4 4 9.373 4 16s5.373 12 12 12 12-5.373 12-12S22.627 4 16 4z" fill="url(#about-logo-gradient)"/>
                                    <path d="M12 12c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2h-4c-1.1 0-2-.9-2-2v-8z" fill="#fff" opacity="0.9"/>
                                    <defs>
                                        <linearGradient id="about-logo-gradient" x1="4" y1="4" x2="28" y2="28">
                                            <stop stop-color="#ff5500"/>
                                            <stop offset="1" stop-color="#ff8800"/>
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                            <div class="about-card__info">
                                <h3>CloudTrail</h3>
                                <p>Version 1.0.0</p>
                            </div>
                        </div>
                        
                        <div class="about-links">
                            <a href="https://github.com/https://github.com/paranoica/root-soundcloud-cloudtrail" target="_blank" class="about-link">
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                </svg>
                                GitHub
                            </a>
                            <a href="mailto:support@cloudtrail.support" class="about-link">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                                </svg>
                                Report Issue
                            </a>
                        </div>
                        
                        <p class="about-footer">
                            Made with love for the SoundCloud community
                        </p>
                    </div>
                </section>
            </div>
        `;
    }

    async updatePeriod() { }
    destroy() { }
}