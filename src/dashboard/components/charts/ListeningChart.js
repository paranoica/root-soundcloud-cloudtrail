export class ListeningChart {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.chart = null;
        this.options = {
            type: options.type || "area",
            showLegend: options.showLegend || false,
            ...options,
        };
    }

    init() {
        if (!this.canvas || typeof Chart === "undefined") {
            console.warn("[ListeningChart] Canvas or Chart.js not available");
            return;
        }

        const ctx = this.canvas.getContext("2d");
        const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);

        gradient.addColorStop(0, "rgba(255, 85, 0, 0.4)");
        gradient.addColorStop(0.5, "rgba(255, 85, 0, 0.1)");
        gradient.addColorStop(1, "rgba(255, 85, 0, 0)");

        const isBar = this.options.type === "bar"; this.chart = new Chart(ctx, {
            type: isBar ? "bar" : "line",
            data: {
                labels: [],
                datasets: [{
                    label: "Listening Time",
                    data: [],
                    fill: !isBar,
                    backgroundColor: isBar ? "rgba(255, 85, 0, 0.8)" : gradient,
                    borderColor: "#ff5500",
                    borderWidth: isBar ? 0 : 2,
                    borderRadius: isBar ? 6 : 0,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: "#ff5500",
                    pointHoverBorderColor: "#fff",
                    pointHoverBorderWidth: 2,
                }]
            },
            options: this._getChartOptions(),
        });
    }

    _getChartOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: "index",
            },
            plugins: {
                legend: {
                    display: this.options.showLegend,
                },
                tooltip: {
                    backgroundColor: "rgba(30, 30, 30, 0.95)",
                    titleColor: "#fff",
                    titleFont: { weight: "600" },
                    bodyColor: "#b3b3b3",
                    borderColor: "#333",
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        title: (items) => items[0]?.label || "",
                        label: (context) => {
                            const minutes = Math.round(context.raw);
                            if (minutes >= 60) {
                                const hours = Math.floor(minutes / 60);
                                const mins = minutes % 60;
                                return `${hours}h ${mins}m listened`;
                            }
                            return `${minutes} minutes listened`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false,
                        drawBorder: false,
                    },
                    ticks: {
                        color: "#727272",
                        font: { size: 11 },
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 10,
                    },
                    border: {
                        display: false,
                    }
                },
                y: {
                    grid: {
                        color: "rgba(255, 255, 255, 0.05)",
                        drawBorder: false,
                    },
                    ticks: {
                        color: "#727272",
                        font: { size: 11 },
                        padding: 8,
                        callback: (value) => {
                            if (value >= 60) {
                                return `${Math.floor(value / 60)}h`;
                            }
                            return `${value}m`;
                        }
                    },
                    border: {
                        display: false,
                    },
                    beginAtZero: true,
                }
            },
            animation: {
                duration: 750,
                easing: "easeOutQuart",
            }
        };
    }

    update(data) {
        if (!this.chart)
            return;

        this.chart.data.labels = data.labels || [];
        this.chart.data.datasets[0].data = data.values || [];

        this.chart.update("none");
    }

    updateAnimated(data) {
        if (!this.chart)
            return;

        this.chart.data.labels = data.labels || [];
        this.chart.data.datasets[0].data = data.values || [];

        this.chart.update();
    }

    resize() {
        if (this.chart) {
            this.chart.resize();
        }
    }

    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}