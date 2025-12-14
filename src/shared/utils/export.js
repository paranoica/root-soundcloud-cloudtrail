export function exportAsJSON(data, filename = "cloudtrail-export.json") {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });

    downloadBlob(blob, filename);
}

export function exportAsCSV(data, filename = "cloudtrail-export.csv") {
    if (!data || !data.length)
        return;

    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(","),
        ...data.map(row =>
            headers.map(header => {
                let value = row[header];

                if (typeof value === "object") {
                    value = JSON.stringify(value);
                }

                if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
                    value = `"${value.replace(/"/g, '""')}"`;
                }

                return value ?? "";
            }).join(",")
        )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

export function readFileAsJSON(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                resolve(data);
            } catch (error) {
                reject(new Error("Invalid JSON file"));
            }
        };

        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
    });
}

export function formatExportSummary(exportData) {
    const tracks = exportData.data?.[Object.keys(exportData.data).find(k => k.includes("tracks"))] || {};
    const dailyStats = exportData.data?.[Object.keys(exportData.data).find(k => k.includes("daily"))] || {};

    return {
        exportedAt: exportData.exportedAt,
        version: exportData.version,
        tracksCount: Object.keys(tracks).length,
        daysTracked: Object.keys(dailyStats).length,
        size: new Blob([JSON.stringify(exportData)]).size,
    };
}