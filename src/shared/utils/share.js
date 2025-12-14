export function generateShareText(stats, period = "all time") {
    const hours = Math.floor(stats.totalSeconds / 3600);
    const minutes = Math.floor((stats.totalSeconds % 3600) / 60);

    let timeStr = ""; if (hours > 0) {
        timeStr = `${hours} hour${hours !== 1 ? "s" : ""}`; if (minutes > 0) {
            timeStr += ` ${minutes} min${minutes !== 1 ? "s" : ""}`;
        }
    } else {
        timeStr = `${minutes} minute${minutes !== 1 ? "s" : ""}`;
    }

    return `🎵 My SoundCloud Stats (${period}):
⏱️ ${timeStr} of listening
🎧 ${stats.totalTracks} unique tracks
👤 ${stats.totalArtists} artists

Tracked with CloudTrail ☁️`;
}

export function generateWrappedShareText(wrapped) {
    const hours = Math.floor(wrapped.summary.totalSeconds / 3600);
    
    const topTrack = wrapped.topTracks[0];
    const topArtist = wrapped.topArtists[0];

    return `☁️ My ${wrapped.year} SoundCloud Wrapped:

⏱️ ${hours} hours of listening
🎵 ${wrapped.summary.totalTracks} tracks discovered
🎤 ${wrapped.summary.totalArtists} artists explored

🏆 Top Track: "${topTrack?.title}" by ${topTrack?.artist}
⭐ Top Artist: ${topArtist?.name}

#CloudTrail #SoundCloud #Wrapped${wrapped.year}`;
}

export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        const textarea = document.createElement("textarea");

        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        
        document.body.appendChild(textarea);
        textarea.select();

        try {
            document.execCommand("copy");
            document.body.removeChild(textarea);

            return true;
        } catch {
            document.body.removeChild(textarea);
            return false;
        }
    }
}

export async function shareViaWebAPI(options) {
    const { title, text, url } = options;

    if (!navigator.share) {
        return false;
    }

    try {
        await navigator.share({ title, text, url });
        return true;
    } catch (error) {
        if (error.name === "AbortError") {
            return false;
        }

        throw error;
    }
}


export function getTwitterShareUrl(text) {
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

export function getShareUrls(text, url = "") {
    const encodedText = encodeURIComponent(text);
    const encodedUrl = encodeURIComponent(url);

    return {
        twitter: `https://twitter.com/intent/tweet?text=${encodedText}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?quote=${encodedText}`,
        telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
        whatsapp: `https://wa.me/?text=${encodedText}`,
        reddit: `https://reddit.com/submit?title=${encodedText}`,
    };
}