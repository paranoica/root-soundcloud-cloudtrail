export class TopTracksChart {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.chart = null;
        this.options = {
            maxItems: options.maxItems || 10,
            metric: options.metric || "playCount",
            ...options,
        };
    }

    init() {
        if (!this.canvas || typeof Chart === "undefined") {
            console.warn("[TopTracksChart] Canvas or Chart.js not available");
            return;
        }

        const ctx = this.canvas.getContext("2d");

        this.chart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: [],
                datasets: [{
                    label: this.options.metric === "playCount" ? "Plays" : "Minutes",
                    data: [],
                    backgroundColor: this._generateGradientColors(),
                    borderRadius: 6,
                    borderSkipped: false,
                }]
            },
            options: this._getChartOptions(),
        });
    }

    _generateGradientColors() {
        const colors = [];
        for (let i = 0; i < this.options.maxItems; i++) {
            const opacity = 1 - (i * 0.07);
            colors.push(`rgba(255, 85, 0, ${Math.max(0.3, opacity)})`);
        }
        return colors;
    }

    _getChartOptions() {
        const isPlayCount = this.options.metric === "playCount";

        return {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: {
                    backgroundColor: "rgba(30, 30, 30, 0.95)",
                    titleColor: "#fff",
                    bodyColor: "#b3b3b3",
                    borderColor: "#333",
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: (context) => {
                            const value = context.raw;
                            if (isPlayCount) {
                                return `${value} plays`;
                            }
                            if (value >= 60) {
                                const hours = Math.floor(value / 60);
                                const mins = value % 60;
                                return `${hours}h ${mins}m`;
                            }
                            return `${value} minutes`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: "rgba(255, 255, 255, 0.05)",
                        drawBorder: false,
                    },
                    ticks: {
                        color: "#727272",
                        font: { size: 11 },
                    },
                    border: {
                        display: false,
                    },
                    beginAtZero: true,
                },
                y: {
                    grid: {
                        display: false,
                    },
                    ticks: {
                        color: "#fff",
                        font: {
                            size: 12,
                            weight: "500",
                        },
                        padding: 8,
                        callback: function (value, index) {
                            const label = this.getLabelForValue(value);
                            if (label.length > 25) {
                                return label.substring(0, 25) + "...";
                            }
                            return label;
                        }
                    },
                    border: {
                        display: false,
                    },
                }
            },
            animation: {
                duration: 750,
                easing: "easeOutQuart",
            }
        };
    }

    update(tracks) {
        if (!this.chart || !tracks)
            return;

        const sorted = [...tracks]
            .sort((a, b) => {
                const aVal = this.options.metric === "playCount" ? a.playCount : a.totalSeconds;
                const bVal = this.options.metric === "playCount" ? b.playCount : b.totalSeconds;
                return bVal - aVal;
            })
            .slice(0, this.options.maxItems);

        const labels = sorted.map(t => t.track?.title || "Unknown");
        const values = sorted.map(t => {
            if (this.options.metric === "playCount") {
                return t.playCount || 0;
            }

            return Math.round((t.totalSeconds || 0) / 60);
        });

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = values;
        this.chart.data.datasets[0].backgroundColor = this._generateGradientColors();

        this.chart.update();
    }

    setMetric(metric) {
        this.options.metric = metric;
        this.chart.data.datasets[0].label = metric === "playCount" ? "Plays" : "Minutes";
    }

    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}