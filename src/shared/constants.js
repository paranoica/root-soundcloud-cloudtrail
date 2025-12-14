export const EXTENSION = {
    NAME: "CloudTrail",
    VERSION: "1.0.0",
    DASHBOARD_URL: chrome.runtime.getURL("src/dashboard/index.html"),
};

export const SOUNDCLOUD = {
    BASE_URL: "https://soundcloud.com",
    API_V2_URL: "https://api-v2.soundcloud.com",
    API_V1_URL: "https://api.soundcloud.com",

    DEFAULT_CLIENT_ID: null,
    SELECTORS: {
        PLAYER_CONTAINER: ".playControls__wrapper, .playControls__elements",
        PLAY_BUTTON: ".playControl",
        PLAYING_CLASS: "playing",

        TRACK_TITLE: ".playbackSoundBadge__titleLink",
        TRACK_ARTIST: ".playbackSoundBadge__lightLink",
        TRACK_ARTWORK: ".playbackSoundBadge__avatar .sc-artwork",

        PROGRESS_BAR: ".playbackTimeline__progressWrapper",
        TIME_PASSED: ".playbackTimeline__timePassed span[aria-hidden='true']",
        TIME_DURATION: ".playbackTimeline__duration span[aria-hidden='true']",

        LIKE_BUTTON: ".playbackSoundBadge__like",
    },

    ENDPOINTS: {
        TRACK: "/tracks/",
        USER: "/users/",
        STREAM: "/stream",
        LIKES: "/likes",
        FOLLOWINGS: "/followings",
        PLAY_HISTORY: "/play-history",
    },
};

export const STORAGE_KEYS = {
    TRACKS: "ct_tracks",
    SESSIONS: "ct_sessions",
    DAILY_STATS: "ct_daily_stats",

    SETTINGS: "ct_settings",
    CLIENT_ID: "ct_client_id",

    TRACK_CACHE: "ct_track_cache",
    ARTIST_CACHE: "ct_artist_cache",

    CURRENT_TRACK: "ct_current_track",
    LAST_SYNC: "ct_last_sync",

    WRAPPED_DATA: "ct_wrapped",
};

export const TIME = {
    TRACKING_INTERVAL: 1000,
    SAVE_INTERVAL: 5000,
    SYNC_INTERVAL: 30000,

    DEBOUNCE_TRACK_CHANGE: 500,
    DEBOUNCE_UI_UPDATE: 100,

    TRACK_CACHE_TTL: 24 * 60 * 60 * 1000,
    ARTIST_CACHE_TTL: 7 * 24 * 60 * 60 * 1000,

    PERIODS: {
        TODAY: "today",
        YESTERDAY: "yesterday",
        WEEK: "week",
        MONTH: "month",
        YEAR: "year",
        ALL_TIME: "all",
    },
};

export const MESSAGES = {
    TRACK_PLAYING: "track:playing",
    TRACK_PAUSED: "track:paused",
    TRACK_CHANGED: "track:changed",
    TRACK_ENDED: "track:ended",
    TRACK_SEEKED: "track:seeked",

    GET_STATS: "stats:get",
    GET_TOP_TRACKS: "stats:topTracks",
    GET_TRACK_DETAILS: "stats:trackDetails",
    GET_DAILY_STATS: "stats:daily",

    GET_SETTINGS: "settings:get",
    UPDATE_SETTINGS: "settings:update",

    API_REQUEST: "api:request",
    CLIENT_ID_FOUND: "api:clientIdFound",

    EXPORT_DATA: "data:export",
    IMPORT_DATA: "data:import",

    GENERATE_WRAPPED: "wrapped:generate",

    GET_STATUS: "status:get",
    HEARTBEAT: "heartbeat",
};

export const PLAYER_STATE = {
    PLAYING: "playing",
    PAUSED: "paused",
    BUFFERING: "buffering",
    STOPPED: "stopped",
};

export const UI = {
    TOP_TRACKS_POPUP: 5,
    TOP_TRACKS_DASHBOARD: 50,
    TOP_ARTISTS_DASHBOARD: 20,

    COLORS: {
        PRIMARY: "#ff5500",
        PRIMARY_LIGHT: "#ff7733",
        SECONDARY: "#333333",
        ACCENT: "#f50",
        SUCCESS: "#2ecc71",
        WARNING: "#f39c12",
        ERROR: "#e74c3c",

        GRADIENT_START: "#ff5500",
        GRADIENT_END: "#ff8800",

        CHART: [
            "#ff5500",
            "#ff7733",
            "#ffaa66",
            "#ffcc99",
            "#ffeecc",
        ],
    },

    WRAPPED_SLIDES: [
        "intro",
        "totalTime",
        "topTracks",
        "topArtists",
        "listeningPatterns",
        "summary",
    ],
};

export const DEFAULT_SETTINGS = {
    language: "en",
    theme: "dark",

    trackingEnabled: true,
    showNotifications: false,

    sharePlayCount: true,
    shareListeningTime: true,

    showArtwork: true,
    compactMode: false,

    autoBackup: false,
    backupInterval: "weekly",

    customClientId: null,
};

export const ERRORS = {
    STORAGE_FULL: "ERR_STORAGE_FULL",
    API_UNAVAILABLE: "ERR_API_UNAVAILABLE",
    INVALID_TRACK: "ERR_INVALID_TRACK",
    PARSE_FAILED: "ERR_PARSE_FAILED",
    NETWORK_ERROR: "ERR_NETWORK",
    UNAUTHORIZED: "ERR_UNAUTHORIZED",
};