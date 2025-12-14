import { MESSAGES } from "../../shared/constants.js";

export class QuickActions {
    constructor() {
        this._bindEvents();
    }

    _bindEvents() {
        const btnSettings = document.getElementById("btn-settings");
        if (btnSettings) {
            btnSettings.addEventListener("click", () => this.openSettings());
        }

        const btnDashboard = document.getElementById("btn-dashboard");
        const btnOpenDashboard = document.getElementById("btn-open-dashboard");

        [btnDashboard, btnOpenDashboard].forEach(btn => {
            if (btn) {
                btn.addEventListener("click", () => this.openDashboard());
            }
        });

        const btnExport = document.getElementById("btn-export");
        if (btnExport) {
            btnExport.addEventListener("click", () => this.exportData());
        }

        const btnViewAll = document.getElementById("btn-view-all");
        if (btnViewAll) {
            btnViewAll.addEventListener("click", () => this.openDashboard("tracks"));
        }
    }

    openDashboard(page = "") {
        const dashboardUrl = chrome.runtime.getURL("src/dashboard/index.html");
        const url = page ? `${dashboardUrl}#/${page}` : dashboardUrl;

        chrome.tabs.create({ url });
        window.close();
    }

    openSettings() {
        this.openDashboard("settings");
    }

    async exportData() {
        const btn = document.getElementById("btn-export");
        const originalContent = btn.innerHTML;

        try {
            btn.disabled = true;
            btn.innerHTML = `
                <div class="loading-spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>
                Exporting...
            `;

            const response = await chrome.runtime.sendMessage({
                type: MESSAGES.EXPORT_DATA,
            });

            if (response.error) {
                throw new Error(response.error);
            }

            const dataStr = JSON.stringify(response, null, 2);

            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);

            const date = new Date().toISOString().split("T")[0];
            const filename = `cloudtrail-export-${date}.json`;

            const link = document.createElement("a");

            link.href = url;
            link.download = filename;

            document.body.appendChild(link);
            link.click();

            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                Exported!
            `;

            setTimeout(() => {
                btn.innerHTML = originalContent;
                btn.disabled = false;
            }, 2000);

        } catch (error) {
            console.error("[QuickActions] Export failed:", error);

            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Error
            `;

            setTimeout(() => {
                btn.innerHTML = originalContent;
                btn.disabled = false;
            }, 2000);
        }
    }
}

export function createQuickActions() {
    return new QuickActions();
}