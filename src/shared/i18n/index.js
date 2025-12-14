import en from "./en.json" assert { type: "json" };
import ru from "./ru.json" assert { type: "json" };
import { STORAGE_KEYS, DEFAULT_SETTINGS } from "../constants.js";

const LANGUAGES = {
    en,
    ru,
};

let currentLanguage = DEFAULT_SETTINGS.language;
let currentTranslations = LANGUAGES[currentLanguage];

export async function initI18n() {
    try {
        const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
        const settings = result[STORAGE_KEYS.SETTINGS] || {};

        if (settings.language && LANGUAGES[settings.language]) {
            currentLanguage = settings.language;
            currentTranslations = LANGUAGES[currentLanguage];
        }
    } catch (error) {
        console.error("[i18n] Failed to load language:", error);
    }

    return currentLanguage;
}

export async function setLanguage(lang) {
    if (!LANGUAGES[lang]) {
        console.warn(`[i18n] Unknown language: ${lang}`);
        return false;
    }

    currentLanguage = lang;
    currentTranslations = LANGUAGES[lang];

    try {
        const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
        const settings = result[STORAGE_KEYS.SETTINGS] || {};

        settings.language = lang;
        await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
    } catch (error) {
        console.error("[i18n] Failed to save language:", error);
    }

    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("languageChanged", { detail: { lang } }));
    }

    return true;
}

export function getLanguage() {
    return currentLanguage;
}

export function t(key, params = {}) {
    const keys = key.split(".");
    let value = currentTranslations;

    for (const k of keys) {
        if (value && typeof value === "object" && k in value) {
            value = value[k];
        } else {
            value = getNestedValue(LANGUAGES.en, keys);
            break;
        }
    }

    if (typeof value !== "string") {
        console.warn(`[i18n] Missing translation: ${key}`);
        return key;
    }

    return value.replace(/\{(\w+)\}/g, (match, param) => {
        return params[param] !== undefined ? params[param] : match;
    });
}

function getNestedValue(obj, keys) {
    let value = obj;
    for (const k of keys) {
        if (value && typeof value === "object" && k in value) {
            value = value[k];
        } else {
            return undefined;
        }
    }
    return value;
}

export function formatNumber(num) {
    return new Intl.NumberFormat(currentLanguage).format(num);
}

export function formatDuration(seconds, long = false) {
    if (seconds < 60) {
        return long ? t("time.seconds", { count: seconds }) : `${seconds}s`;
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours === 0) {
        return long ? t("time.minutes", { count: minutes }) : `${minutes}m ${secs}s`;
    }

    if (long) {
        if (hours >= 24) {
            const days = Math.floor(hours / 24);
            const remainingHours = hours % 24;

            return t("time.daysHours", { days, hours: remainingHours });
        }

        return t("time.hoursMinutes", { hours, minutes });
    }

    return `${hours}h ${minutes}m`;
}

export function formatRelativeTime(timestamp) {
    const rtf = new Intl.RelativeTimeFormat(currentLanguage, { numeric: "auto" });
    const diff = timestamp - Date.now();

    const diffSeconds = Math.floor(diff / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);

    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (Math.abs(diffDays) >= 1) {
        return rtf.format(diffDays, "day");
    }

    if (Math.abs(diffHours) >= 1) {
        return rtf.format(diffHours, "hour");
    }

    if (Math.abs(diffMinutes) >= 1) {
        return rtf.format(diffMinutes, "minute");
    }

    return t("time.justNow");
}

export function getAvailableLanguages() {
    return [
        { code: "en", name: "English", nativeName: "English" },
        { code: "ru", name: "Russian", nativeName: "Русский" },
    ];
}

export default {
    init: initI18n,
    t,
    setLanguage,
    getLanguage,
    formatNumber,
    formatDuration,
    formatRelativeTime,
    getAvailableLanguages,
};