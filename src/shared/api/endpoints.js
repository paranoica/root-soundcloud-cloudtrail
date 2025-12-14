const API_V2_BASE = "https://api-v2.soundcloud.com";
//const API_V1_BASE = "https://api.soundcloud.com";
//const WEB_BASE = "https://soundcloud.com";

export const ENDPOINTS = {
    TRACK: (trackId) => `${API_V2_BASE}/tracks/${trackId}`,
    TRACKS: `${API_V2_BASE}/tracks`,
    TRACK_STREAMS: (trackId) => `${API_V2_BASE}/tracks/${trackId}/streams`,
    TRACK_LIKERS: (trackId) => `${API_V2_BASE}/tracks/${trackId}/likers`,
    TRACK_RELATED: (trackId) => `${API_V2_BASE}/tracks/${trackId}/related`,

    USER: (userId) => `${API_V2_BASE}/users/${userId}`,
    USER_TRACKS: (userId) => `${API_V2_BASE}/users/${userId}/tracks`,
    USER_LIKES: (userId) => `${API_V2_BASE}/users/${userId}/likes`,
    USER_FOLLOWINGS: (userId) => `${API_V2_BASE}/users/${userId}/followings`,
    USER_FOLLOWERS: (userId) => `${API_V2_BASE}/users/${userId}/followers`,
    USER_STREAM: (userId) => `${API_V2_BASE}/stream/users/${userId}`,

    ME: `${API_V2_BASE}/me`,
    ME_LIKES: `${API_V2_BASE}/me/likes`,
    ME_FOLLOWINGS: `${API_V2_BASE}/me/followings`,
    ME_STREAM: `${API_V2_BASE}/me/play-history/tracks`,
    ME_LIBRARY: `${API_V2_BASE}/me/library/all`,

    SEARCH: `${API_V2_BASE}/search`,
    SEARCH_TRACKS: `${API_V2_BASE}/search/tracks`,
    SEARCH_USERS: `${API_V2_BASE}/search/users`,

    RESOLVE: `${API_V2_BASE}/resolve`,

    FEATURED: `${API_V2_BASE}/featured_tracks/top/all-music`,
    CHARTS: `${API_V2_BASE}/charts`,

    PLAYLIST: (playlistId) => `${API_V2_BASE}/playlists/${playlistId}`,
};

export function buildUrl(endpoint, params = {}) {
    const url = new URL(endpoint);

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.set(key, String(value));
        }
    });

    return url.toString();
}

export const DEFAULT_PARAMS = {
    limit: 50,
    offset: 0,
    linked_partitioning: 1,
    app_version: 1700242586,
    app_locale: "en",
};

export function getAuthParams(clientId, oauthToken = null) {
    const params = {
        client_id: clientId,
    };

    if (oauthToken) {
        params.oauth_token = oauthToken;
    }

    return params;
}


export function isSoundCloudApiUrl(url) {
    return url.includes("api-v2.soundcloud.com") || url.includes("api.soundcloud.com");
}

export function isSoundCloudWebUrl(url) {
    return url.includes("soundcloud.com") && !isSoundCloudApiUrl(url);
}

export function extractPermalink(url) {
    try {
        const urlObj = new URL(url);
        if (!urlObj.hostname.includes("soundcloud.com"))
            return null;

        const path = urlObj.pathname.replace(/^\//, "");
        const skipPaths = ["discover", "stream", "library", "you", "settings", "messages", "notifications", "search", "upload", "charts", "tags"];
        const firstSegment = path.split("/")[0];

        if (skipPaths.includes(firstSegment))
            return null;

        const segments = path.split("/").filter(Boolean);
        if (segments.length >= 2) {
            return `${segments[0]}/${segments[1]}`;
        }

        return null;
    } catch {
        return null;
    }
}

export function extractClientId(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.searchParams.get("client_id");
    } catch {
        return null;
    }
}

export function extractOAuthToken(url, headers = {}) {
    try {
        const urlObj = new URL(url);
        const tokenFromUrl = urlObj.searchParams.get("oauth_token");

        if (tokenFromUrl)
            return tokenFromUrl;

        const authHeader = headers["Authorization"] || headers["authorization"];
        if (authHeader && authHeader.startsWith("OAuth ")) {
            return authHeader.replace("OAuth ", "");
        }

        return null;
    } catch {
        return null;
    }
}