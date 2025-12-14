export class PieChart {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.chart = null;
        this.options = {
            type: options.type || "doughnut",
            cutout: options.cutout || "70%",
            ...options,
        };
    }

    init() {
        if (!this.canvas || typeof Chart === "undefined")
            return;

        const ctx = this.canvas.getContext("2d"); this.chart = new Chart(ctx, {
            type: this.options.type,
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        "#ff5500",
                        "#ff7733",
                        "#ff9966",
                        "#ffbb99",
                        "#ffddcc",
                        "#cc4400",
                        "#993300",
                        "#662200",
                    ],
                    borderWidth: 0,
                    hoverOffset: 8,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: this.options.type === "doughnut" ? this.options.cutout : 0,
                plugins: {
                    legend: {
                        display: true,
                        position: "right",
                        labels: {
                            color: "#b3b3b3",
                            font: { size: 12 },
                            padding: 16,
                            usePointStyle: true,
                            pointStyle: "circle",
                        }
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
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${context.label}: ${percentage}%`;
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

    update(data) {
        if (!this.chart)
            return;

        this.chart.data.labels = data.labels || [];
        this.chart.data.datasets[0].data = data.values || [];

        this.chart.update();
    }

    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}