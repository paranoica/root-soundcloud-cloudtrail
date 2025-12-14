import { MESSAGES } from "../../../shared/constants.js";
import { showToast } from "../../utils/toast.js";

export class Header {
    constructor(options = {}) {
        this.onPeriodChange = options.onPeriodChange || (() => { });
        this.onRefresh = options.onRefresh || (() => { });

        this.periodSelector = document.getElementById("period-selector");
        this.titleEl = document.getElementById("page-title");

        this._currentPeriod = "week";
        this._init();
    }

    _init() {
        if (this.periodSelector) {
            const buttons = this.periodSelector.querySelectorAll(".period-selector__btn"); buttons.forEach(btn => {
                btn.addEventListener("click", () => {
                    const period = btn.dataset.period;
                    this.setPeriod(period);
                });
            });
        }

        const refreshBtn = document.getElementById("btn-refresh");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", async () => {
                refreshBtn.classList.add("spinning");
                await this.onRefresh();
                setTimeout(() => refreshBtn.classList.remove("spinning"), 500);
            });
        }

        const exportBtn = document.getElementById("btn-export");
        if (exportBtn) {
            exportBtn.addEventListener("click", () => this._handleExport());
        }
    }

    setTitle(title) {
        if (this.titleEl) {
            this.titleEl.textContent = title;
        }
    }

    setPeriod(period) {
        if (period === this._currentPeriod)
            return;

        this._currentPeriod = period;
        const buttons = this.periodSelector?.querySelectorAll(".period-selector__btn"); buttons?.forEach(btn => {
            btn.classList.toggle("active", btn.dataset.period === period);
        });

        this.onPeriodChange(period);
    }

    getPeriod() {
        return this._currentPeriod;
    }

    showPeriodSelector(visible) {
        if (this.periodSelector) {
            this.periodSelector.style.display = visible ? "flex" : "none";
        }
    }

    async _handleExport() {
        try {
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
            const link = document.createElement("a");

            link.href = url;
            link.download = `cloudtrail-export-${date}.json`;

            document.body.appendChild(link);
            link.click();

            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showToast("Data exported successfully!", "success");
        } catch (error) {
            showToast("Export failed. Please try again.", "error");
        }
    }
}