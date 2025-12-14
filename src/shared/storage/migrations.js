import { SCHEMA_VERSION } from "./schema.js";

const MIGRATIONS = [
    {
        version: 1,
        description: "Initial schema",
        up: async (data) => {
            return data;
        },
    },
];

async function getCurrentVersion() {
    try {
        const result = await chrome.storage.local.get("ct_schema_version");
        return result.ct_schema_version || 0;
    } catch {
        return 0;
    }
}

async function setCurrentVersion(version) {
    await chrome.storage.local.set({ ct_schema_version: version });
}

export async function runMigrations() {
    const currentVersion = await getCurrentVersion();
    if (currentVersion >= SCHEMA_VERSION) {
        console.log("[Migrations] Schema is up to date (v" + currentVersion + ")");
        return false;
    }

    const pendingMigrations = MIGRATIONS.filter(m => m.version > currentVersion);
    if (pendingMigrations.length === 0) {
        await setCurrentVersion(SCHEMA_VERSION);
        return false;
    }

    try {
        const data = await chrome.storage.local.get(null);
        let migratedData = { ...data };

        for (const migration of pendingMigrations) {
            console.log(`[Migrations] Running migration v${migration.version}: ${migration.description}`);
            migratedData = await migration.up(migratedData);
        }

        await chrome.storage.local.set(migratedData);
        await setCurrentVersion(SCHEMA_VERSION);

        return true;
    } catch (error) {
        console.error("[Migrations] Migration failed:", error);
        throw error;
    }
}

export async function needsMigration() {
    const currentVersion = await getCurrentVersion();
    return currentVersion < SCHEMA_VERSION;
}

export async function resetAllData() {
    const keysToKeep = ["ct_settings", "ct_schema_version"];

    const allData = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(allData).filter(
        key => key.startsWith("ct_") && !keysToKeep.includes(key)
    );

    await chrome.storage.local.remove(keysToRemove);
    console.log("[Migrations] Data reset complete");
}

export async function exportData() {
    const data = await chrome.storage.local.get(null);
    const exportData = {};

    for (const [key, value] of Object.entries(data)) {
        if (key.startsWith("ct_")) {
            exportData[key] = value;
        }
    }

    return {
        version: SCHEMA_VERSION,
        exportedAt: Date.now(),
        data: exportData,
    };
}

export async function importData(backup) {
    if (!backup || !backup.data) {
        throw new Error("Invalid backup format");
    }

    if (backup.version > SCHEMA_VERSION) {
        throw new Error("Backup is from a newer version");
    }

    try {
        await chrome.storage.local.set(backup.data);
        if (backup.version < SCHEMA_VERSION) {
            await runMigrations();
        }

        return true;
    } catch (error) {
        console.error("[Migrations] Import failed:", error);
        throw error;
    }
}