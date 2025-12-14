export class HourlyChart {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.chart = null;
        this.options = options;
    }

    init() {
        if (!this.canvas || typeof Chart === "undefined")
            return;

        const ctx = this.canvas.getContext("2d");
        const labels = [];

        for (let i = 0; i < 24; i++) {
            labels.push(i.toString().padStart(2, "0") + ":00");
        }

        this.chart = new Chart(ctx, {
            type: "polarArea",
            data: {
                labels: labels,
                datasets: [{
                    data: new Array(24).fill(0),
                    backgroundColor: this._generateColors(24),
                    borderWidth: 0,
                }]
            },
            options: {
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
                                const minutes = Math.round(context.raw);
                                if (minutes >= 60) {
                                    const hours = Math.floor(minutes / 60);
                                    const mins = minutes % 60;
                                    return `${hours}h ${mins}m`;
                                }
                                return `${minutes} min`;
                            }
                        }
                    }
                },
                scales: {
                    r: {
                        grid: {
                            color: "rgba(255, 255, 255, 0.05)",
                        },
                        ticks: {
                            display: false,
                        },
                        pointLabels: {
                            color: "#727272",
                            font: { size: 10 },
                            callback: (label, index) => {
                                return index % 3 === 0 ? label : "";
                            }
                        }
                    }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true,
                }
            }
        });
    }

    _generateColors(count) {
        const colors = [];
        for (let i = 0; i < count; i++) {
            colors.push("rgba(255, 85, 0, 0.6)");
        }
        return colors;
    }

    update(hourlyData) {
        if (!this.chart || !hourlyData)
            return;

        const data = [];
        let maxValue = 0;

        for (let i = 0; i < 24; i++) {
            const value = Math.round((hourlyData[i] || 0) / 60); data.push(value);
            if (value > maxValue)
                maxValue = value;
        }

        const colors = data.map(value => {
            if (value === 0 || maxValue === 0) {
                return "rgba(255, 85, 0, 0.1)";
            }

            const intensity = 0.2 + (value / maxValue) * 0.7;
            return `rgba(255, 85, 0, ${intensity})`;
        });

        this.chart.data.datasets[0].data = data;
        this.chart.data.datasets[0].backgroundColor = colors;

        this.chart.update();
    }

    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}