/**
 * @typedef {Object} Track
 * @property {string} id - SoundCloud track ID
 * @property {string} permalink - Track URL path
 * @property {string} title - Track title
 * @property {string} artistId - Artist/user ID
 * @property {string} artistName - Artist display name
 * @property {string} artistPermalink - Artist URL path
 * @property {string|null} artworkUrl - Track artwork URL (500x500)
 * @property {number} duration - Track duration in milliseconds
 * @property {string|null} genre - Track genre
 * @property {boolean} isLiked - Whether user liked this track
 * @property {number} scPlayCount - SoundCloud"s play count (if available)
 */
export const TrackSchema = {
    id: "",
    permalink: "",
    title: "",
    artistId: "",
    artistName: "",
    artistPermalink: "",
    artworkUrl: null,
    duration: 0,
    genre: null,
    isLiked: false,
    scPlayCount: null,
};

/**
 * @typedef {Object} TrackStats
 * @property {string} trackId - Reference to track
 * @property {number} playCount - Number of plays (>30s counts as play)
 * @property {number} totalSeconds - Total seconds listened
 * @property {number} firstPlayedAt - Timestamp of first play
 * @property {number} lastPlayedAt - Timestamp of last play
 * @property {Object} dailySeconds - Seconds per day { "YYYY-MM-DD": seconds }
 */
export const TrackStatsSchema = {
    trackId: "",
    playCount: 0,
    totalSeconds: 0,
    firstPlayedAt: 0,
    lastPlayedAt: 0,
    dailySeconds: {},
};

/**
 * @typedef {Object} ListeningSession
 * @property {string} id - Session UUID
 * @property {string} trackId - Track being played
 * @property {number} startedAt - Session start timestamp
 * @property {number} endedAt - Session end timestamp (0 if ongoing)
 * @property {number} seconds - Seconds listened in this session
 * @property {boolean} completed - Whether track was completed (>90%)
 */
export const SessionSchema = {
    id: "",
    trackId: "",
    startedAt: 0,
    endedAt: 0,
    seconds: 0,
    completed: false,
};

/**
 * @typedef {Object} DailyStats
 * @property {string} date - Date string "YYYY-MM-DD"
 * @property {number} totalSeconds - Total seconds listened
 * @property {number} tracksPlayed - Unique tracks played
 * @property {number} sessionsCount - Number of sessions
 * @property {Object} hourlySeconds - Seconds per hour { "0"-"23": seconds }
 */
export const DailyStatsSchema = {
    date: "",
    totalSeconds: 0,
    tracksPlayed: 0,
    sessionsCount: 0,
    hourlySeconds: {},
};

/**
 * @typedef {Object} Artist
 * @property {string} id - SoundCloud user ID
 * @property {string} username - Username
 * @property {string} permalink - Profile URL path
 * @property {string} displayName - Display name
 * @property {string|null} avatarUrl - Avatar URL
 * @property {boolean} isFollowing - Whether user follows this artist
 * @property {number|null} followersCount - Follower count
 */
export const ArtistSchema = {
    id: "",
    username: "",
    permalink: "",
    displayName: "",
    avatarUrl: null,
    isFollowing: false,
    followersCount: null,
};

/**
 * @typedef {Object} WrappedData
 * @property {number} year - Year of wrapped
 * @property {number} generatedAt - Generation timestamp
 * @property {Object} summary - Summary stats
 * @property {Array} topTracks - Top tracks for the year
 * @property {Array} topArtists - Top artists for the year
 * @property {Object} patterns - Listening patterns
 */
export const WrappedDataSchema = {
    year: 0,
    generatedAt: 0,
    summary: {
        totalSeconds: 0,
        totalTracks: 0,
        totalArtists: 0,
        totalSessions: 0,
        longestSession: 0,
        mostActiveDay: null,
        mostActiveHour: null,
    },
    topTracks: [], // Top 10 tracks
    topArtists: [], // Top 10 artists
    patterns: {
        byDayOfWeek: {}, // { 0-6: seconds }
        byHour: {},      // { 0-23: seconds }
        byMonth: {},     // { 1-12: seconds }
    },
};

/**
 * @typedef {Object} CurrentPlaybackState
 * @property {boolean} isPlaying - Is track currently playing
 * @property {Object|null} track - Current track info
 * @property {number} position - Current position in seconds
 * @property {number} sessionStart - When current session started
 * @property {number} sessionSeconds - Seconds in current session
 */
export const CurrentStateSchema = {
    isPlaying: false,
    track: null,
    position: 0,
    sessionStart: 0,
    sessionSeconds: 0,
};

/**
 * Validates and fills missing fields with defaults
 * @param {Object} data - Data to validate
 * @param {Object} schema - Schema to validate against
 * @returns {Object} Validated data with all fields
 */
export function validateSchema(data, schema) {
    if (!data || typeof data !== "object") {
        return { ...schema };
    }

    const validated = { ...schema };
    for (const key of Object.keys(schema)) {
        if (data[key] !== undefined) {
            if (
                typeof schema[key] === "object" &&
                schema[key] !== null &&
                !Array.isArray(schema[key])
            ) {
                validated[key] = { ...schema[key], ...data[key] };
            } else {
                validated[key] = data[key];
            }
        }
    }

    return validated;
}

/**
 * Creates a new track stats entry
 * @param {string} trackId 
 * @returns {TrackStats}
 */
export function createTrackStats(trackId) {
    return {
        ...TrackStatsSchema,
        trackId,
        firstPlayedAt: Date.now(),
        lastPlayedAt: Date.now(),
    };
}

/**
 * Creates a new session entry
 * @param {string} trackId 
 * @returns {ListeningSession}
 */
export function createSession(trackId) {
    return {
        ...SessionSchema,
        id: crypto.randomUUID(),
        trackId,
        startedAt: Date.now(),
    };
}

/**
 * Creates daily stats entry for today
 * @returns {DailyStats}
 */
export function createDailyStats() {
    const today = new Date().toISOString().split("T")[0];
    return {
        ...DailyStatsSchema,
        date: today,
    };
}

export const SCHEMA_VERSION = 1;