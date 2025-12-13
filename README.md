# ☁️ CloudTrail

> Premium SoundCloud listening statistics tracker for Chromium browsers

![CloudTrail Banner](assets/images/logo.svg)

## Features

- **Real-time Tracking** — Counts every second of your listening time
- **Beautiful Dashboard** — Premium design with rich visualizations
- **Top Tracks** — See your most played tracks by play count
- **Time Filters** — Filter stats by day, week, month, year, or all time
- **Wrapped Experience** — Spotify Wrapped-style yearly summary
- **Share Stats** — Generate beautiful cards to share your stats
- **Multi-language** — English and Russian support
- **Background Tracking** — Works even when tab is in background

## Installation

### From Chrome Web Store
*(Coming soon)*

### Manual Installation
1. Download or clone this repository
2. Run `npm install && npm run build`
3. Open `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked"
6. Select the `dist` folder

## How It Works

CloudTrail intercepts SoundCloud's internal API calls to accurately detect:
- Currently playing track
- Play/pause state
- Track metadata (title, artist, artwork)

All data is stored locally in your browser using IndexedDB.

## Data Structure
```
Track Play Record:
├── trackId
├── title
├── artist
├── artworkUrl
├── playCount (number of times played)
├── totalSeconds (accumulated listening time)
├── lastPlayedAt
└── sessions[] (individual play sessions)
```

## Privacy

- **No data leaves your browser** — All stats are stored locally
- **No account required** — Works without any sign-up
- **No tracking** — We don't collect any analytics

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Create ZIP for store submission
npm run zip
```

## Project Structure
```
cloudtrail/
├── manifest.json          # Extension manifest
├── src/
│   ├── background/        # Service Worker scripts
│   ├── content/           # Content scripts for SC pages
│   ├── popup/             # Quick popup interface
│   ├── dashboard/         # Full statistics dashboard
│   └── shared/            # Shared utilities & constants
├── assets/                # Icons, images, fonts
└── _locales/              # Internationalization
```

## Localization
CloudTrail supports:
- 🇺🇸 English (default)
- 🇷🇺 Russian

## License
MIT License — feel free to use and modify.