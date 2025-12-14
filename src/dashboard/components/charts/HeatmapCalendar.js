export class HeatmapCalendar {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            weeks: options.weeks || 52,
            cellSize: options.cellSize || 12,
            cellGap: options.cellGap || 3,
            showMonthLabels: options.showMonthLabels !== false,
            showDayLabels: options.showDayLabels !== false,
            colorEmpty: options.colorEmpty || "#1e1e1e",
            colorScale: options.colorScale || [
                "#1e1e1e", // 0
                "#3d1f00", // 1-25%
                "#662200", // 25-50%
                "#993300", // 50-75%
                "#cc4400", // 75-90%
                "#ff5500", // 90-100%
            ],
            ...options,
        };

        this._data = new Map();
        this._maxValue = 0;
    }

    render() {
        if (!this.container)
            return;

        const { weeks, cellSize, cellGap, showMonthLabels, showDayLabels } = this.options;

        const labelWidth = showDayLabels ? 30 : 0;
        //const labelHeight = showMonthLabels ? 20 : 0;

        const width = labelWidth + (weeks * (cellSize + cellGap));
        //const height = labelHeight + (7 * (cellSize + cellGap));

        let html = `
            <div class="heatmap" style="width: ${width}px;">
                ${showMonthLabels ? this._renderMonthLabels() : ""}

                <div class="heatmap__grid" style="display: flex; gap: ${cellGap}px;">
                    ${showDayLabels ? this._renderDayLabels() : ""}
                    <div class="heatmap__weeks" style="display: flex; gap: ${cellGap}px;">
                        ${this._renderWeeks()}
                    </div>
                </div>

                <div class="heatmap__legend">
                    <span class="heatmap__legend-label">Less</span>
                    <div class="heatmap__legend-scale">
                        ${this.options.colorScale.map(color =>
                        `<div class="heatmap__legend-cell" style="background: ${color}; width: ${cellSize}px; height: ${cellSize}px;"></div>`
                    ).join("")}
                    </div>
                    <span class="heatmap__legend-label">More</span>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this._bindTooltips();
    }

    _renderMonthLabels() {
        const { weeks, cellSize, cellGap } = this.options;
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        const today = new Date();
        const startDate = new Date(today); startDate.setDate(startDate.getDate() - (weeks * 7));

        let currentMonth = -1;
        const monthPositions = [];

        for (let w = 0; w < weeks; w++) {
            const weekDate = new Date(startDate); weekDate.setDate(weekDate.getDate() + (w * 7));
            const month = weekDate.getMonth();

            if (month !== currentMonth) {
                monthPositions.push({
                    month: months[month],
                    position: w * (cellSize + cellGap) + 30,
                });

                currentMonth = month;
            }
        }

        return `
            <div class="heatmap__months" style="height: 20px; position: relative; margin-left: 30px;">
                ${monthPositions.map(m =>
                    `<span class="heatmap__month" style="position: absolute; left: ${m.position}px; font-size: 11px; color: #727272;">${m.month}</span>`
                ).join("")}
            </div>
        `;
    }

    _renderDayLabels() {
        const { cellSize, cellGap } = this.options;
        const days = ["", "Mon", "", "Wed", "", "Fri", ""];

        return `
            <div class="heatmap__days" style="display: flex; flex-direction: column; gap: ${cellGap}px; width: 30px;">
                ${days.map(day =>
                    `<span class="heatmap__day" style="height: ${cellSize}px; font-size: 10px; color: #727272; display: flex; align-items: center;">${day}</span>`
                ).join("")}
            </div>
        `;
    }

    _renderWeeks() {
        const { weeks, cellSize, cellGap } = this.options;
        const today = new Date(); today.setHours(0, 0, 0, 0);

        let weeksHtml = "";
        const startDate = new Date(today);

        startDate.setDate(startDate.getDate() - (weeks * 7));
        startDate.setDate(startDate.getDate() - startDate.getDay());

        for (let w = 0; w < weeks; w++) {
            let weekHtml = `
                <div class="heatmap__week" style="display: flex; flex-direction: column; gap: ${cellGap}px;">
            `;

            for (let d = 0; d < 7; d++) {
                const date = new Date(startDate); date.setDate(date.getDate() + (w * 7) + d);

                const dateStr = this._formatDate(date);
                const value = this._data.get(dateStr) || 0;

                const color = this._getColor(value);
                const isFuture = date > today;

                weekHtml += `
                    <div 
                        class="heatmap__cell" 
                        data-date="${dateStr}"
                        data-value="${value}"
                        style="
                        width: ${cellSize}px; 
                        height: ${cellSize}px; 
                        background: ${isFuture ? "transparent" : color}; 
                        border-radius: 2px;
                        cursor: ${isFuture ? "default" : "pointer"};
                        ${isFuture ? "border: 1px dashed #333;" : ""}
                        "
                    ></div>
                `;
            }

            weekHtml += "</div>";
            weeksHtml += weekHtml;
        }

        return weeksHtml;
    }

    _getColor(value) {
        if (value === 0 || this._maxValue === 0) {
            return this.options.colorScale[0];
        }

        const percentage = value / this._maxValue;

        if (percentage <= 0.1) return this.options.colorScale[1];
        if (percentage <= 0.25) return this.options.colorScale[2];
        if (percentage <= 0.5) return this.options.colorScale[3];
        if (percentage <= 0.75) return this.options.colorScale[4];

        return this.options.colorScale[5];
    }

    _bindTooltips() {
        const cells = this.container.querySelectorAll(".heatmap__cell[data-value]"); cells.forEach(cell => {
            cell.addEventListener("mouseenter", (e) => {
                const date = cell.dataset.date;
                const value = parseInt(cell.dataset.value) || 0;

                if (value === 0)
                    return;

                const minutes = Math.round(value / 60);
                const dateObj = new Date(date);

                const dateStr = dateObj.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                });

                let timeStr; if (minutes >= 60) {
                    const hours = Math.floor(minutes / 60);
                    const mins = minutes % 60;

                    timeStr = `${hours}h ${mins}m`;
                } else {
                    timeStr = `${minutes} min`;
                }

                this._showTooltip(e, `${timeStr} on ${dateStr}`);
            });

            cell.addEventListener("mouseleave", () => {
                this._hideTooltip();
            });
        });
    }

    _showTooltip(event, text) {
        let tooltip = document.querySelector(".heatmap-tooltip");

        if (!tooltip) {
            tooltip = document.createElement("div");
            tooltip.className = "heatmap-tooltip";
            document.body.appendChild(tooltip);
        }

        tooltip.textContent = text;
        tooltip.style.display = "block";

        tooltip.style.left = `${event.pageX + 10}px`;
        tooltip.style.top = `${event.pageY - 30}px`;
    }

    _hideTooltip() {
        const tooltip = document.querySelector(".heatmap-tooltip");
        if (tooltip) {
            tooltip.style.display = "none";
        }
    }

    update(dailyData) {
        this._data.clear();
        this._maxValue = 0;

        if (dailyData) {
            Object.entries(dailyData).forEach(([date, seconds]) => {
                this._data.set(date, seconds);
                if (seconds > this._maxValue) {
                    this._maxValue = seconds;
                }
            });
        }

        this.render();
    }

    _formatDate(date) {
        return date.toISOString().split("T")[0];
    }

    destroy() {
        if (this.container) {
            this.container.innerHTML = "";
        }

        this._hideTooltip();
    }
}