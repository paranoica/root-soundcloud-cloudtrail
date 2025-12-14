export function formatDuration(totalSeconds, options = {}) {
    const {
        style = "short",  // "short" | "long" | "digital"
        showSeconds = true,
        maxUnits = 3,
    } = options;

    if (totalSeconds < 0)
        totalSeconds = 0;

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);

    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    if (style === "digital") {
        if (days > 0) {
            return `${days}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
        }

        if (hours > 0) {
            return `${hours}:${pad(minutes)}:${pad(seconds)}`;
        }

        return `${minutes}:${pad(seconds)}`;
    }

    const parts = [];
    if (style === "long") {
        if (days > 0) parts.push(`${days} ${pluralize(days, "day", "days")}`);
        if (hours > 0) parts.push(`${hours} ${pluralize(hours, "hour", "hours")}`);
        if (minutes > 0) parts.push(`${minutes} ${pluralize(minutes, "minute", "minutes")}`);
        if (showSeconds && seconds > 0) parts.push(`${seconds} ${pluralize(seconds, "second", "seconds")}`);
    } else {
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (showSeconds && seconds > 0 && parts.length < maxUnits) parts.push(`${seconds}s`);
    }

    if (parts.length === 0) {
        return showSeconds ? "0s" : "0m";
    }

    return parts.slice(0, maxUnits).join(" ");
}

function pad(num) {
    return num.toString().padStart(2, "0");
}

function pluralize(count, singular, plural) {
    return count === 1 ? singular : plural;
}

export function getDateString(date = new Date()) {
    if (typeof date === "number") {
        date = new Date(date);
    }

    return date.toISOString().split("T")[0];
}

export function getStartOfDay(date = new Date()) {
    if (typeof date === "number") {
        date = new Date(date);
    }

    const d = new Date(date); d.setHours(0, 0, 0, 0);
    return d.getTime();
}

export function getStartOfWeek(date = new Date()) {
    if (typeof date === "number") {
        date = new Date(date);
    }

    const d = new Date(date);

    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);

    d.setDate(diff);
    d.setHours(0, 0, 0, 0);

    return d.getTime();
}

export function getStartOfMonth(date = new Date()) {
    if (typeof date === "number") {
        date = new Date(date);
    }

    const d = new Date(date);

    d.setDate(1);
    d.setHours(0, 0, 0, 0);

    return d.getTime();
}

export function getStartOfYear(date = new Date()) {
    if (typeof date === "number") {
        date = new Date(date);
    }

    const d = new Date(date);

    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);

    return d.getTime();
}

export function getDateRange(period) {
    let start;
    const now = new Date(); const end = now.getTime();

    switch (period) {
        case "today":
            start = getStartOfDay(now);
            break;
        case "yesterday":
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            start = getStartOfDay(yesterday);
            break;
        case "week":
            start = getStartOfWeek(now);
            break;
        case "month":
            start = getStartOfMonth(now);
            break;
        case "year":
            start = getStartOfYear(now);
            break;
        case "all":
        default:
            start = 0;
            break;
    }

    return { start, end };
}

export function getDatesBetween(startTs, endTs) {
    const dates = [];

    const end = new Date(endTs);
    const current = new Date(startTs);

    while (current <= end) {
        dates.push(getDateString(current));
        current.setDate(current.getDate() + 1);
    }

    return dates;
}

export function getHour(timestamp) {
    return new Date(timestamp).getHours();
}

export function getDayOfWeek(timestamp) {
    return new Date(timestamp).getDay();
}

export function getMonth(timestamp) {
    return new Date(timestamp).getMonth() + 1;
}

export function getYear(timestamp) {
    return new Date(timestamp).getFullYear();
}

export function formatRelativeTime(timestamp) {
    const diff = Date.now() - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);

    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
        return new Date(timestamp).toLocaleDateString();
    }

    if (days > 0) {
        return `${days}d ago`;
    }

    if (hours > 0) {
        return `${hours}h ago`;
    }

    if (minutes > 0) {
        return `${minutes}m ago`;
    }

    return "Just now";
}

export function getFunEquivalent(totalSeconds) {
    const hours = totalSeconds / 3600;

    const movies = Math.round(hours / 2);
    const flights = Math.round(hours / 14 * 10) / 10;

    const audiobooks = Math.round(hours / 10);
    const daysAwake = Math.round(hours / 16 * 10) / 10;

    return {
        movies,
        flights,
        audiobooks,
        daysAwake,
        getBest() {
            if (movies >= 1 && movies < 10) return { type: "movies", count: movies };
            if (audiobooks >= 1 && audiobooks < 20) return { type: "audiobooks", count: audiobooks };
            if (flights >= 0.5) return { type: "flights", count: flights };
            return { type: "movies", count: movies || 1 };
        }
    };
}