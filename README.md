# AniStream — Your Anime Universe 

**A blazing-fast, mobile-first anime discovery app. Browse, search, and track your favorite anime — installable as a PWA or a native Android app.**

![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-F7DF1E?style=flat&logo=javascript&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat&logo=pwa&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor-Android-119EFF?style=flat&logo=capacitor&logoColor=white)
![Jikan API](https://img.shields.io/badge/Jikan-MyAnimeList_API-2E51A2?style=flat)
![License](https://img.shields.io/badge/License-MIT-green?style=flat)

</div>

---

##  Overview

**AniStream** is a sleek, app-like anime companion that lets users discover trending shows, explore by genre, search the entire MyAnimeList catalog, watch trailers, and keep a personal **watchlist** and **watch history** — all stored locally on the device.

It's built with **zero frameworks** (pure HTML, CSS & JavaScript), works **offline** through a service worker, installs as a **Progressive Web App**, and ships as a **native Android app** via Capacitor.

>  Data is powered by the [Jikan API](https://jikan.moe) — the unofficial, open MyAnimeList API.

---

## Features

-  **Home feed** — Trending, Top Rated, Airing Now & Upcoming sections with a dynamic hero banner
-  **Browse by genre** — 16 curated genres (Action, Romance, Sci-Fi, Shounen & more)
-  **Live search** — Debounced search with type filters (TV, Movie, OVA, Special, ONA)
-  **Rich detail pages** — Synopsis, embedded trailers, ratings, studios, episodes & full metadata
-  **Personal watchlist** — Save anime to your own list
-  **Watch history** — Automatically tracks recently viewed titles
-  **Dark / Light theme** — Persistent theme switcher
-  **Installable** — Add to home screen (PWA) or install the Android APK
-  **Offline-ready** — Service worker caching with smart network-first / cache-first strategies
-  **Built-in rate limiting & response caching** — Respects the Jikan API and keeps the UI snappy
-  **Share** — Native share sheet / clipboard fallback

---

##  Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla JavaScript (ES6+), HTML5, CSS3 (custom properties, responsive grid) |
| **Architecture** | Single-Page App with a client-side router & component-style render functions |
| **Data** | [Jikan API v4](https://docs.api.jikan.moe/) (MyAnimeList) |
| **Storage** | `localStorage` (watchlist, history, theme) + in-memory API cache |
| **Offline / PWA** | Web App Manifest + Service Worker |
| **Mobile** | [Capacitor](https://capacitorjs.com/) (Android native wrapper) |
| **Fonts** | Inter (Google Fonts) |

---

##  Getting Started

### Run the web app (PWA)

Because the app uses a service worker, serve it over HTTP (not `file://`):

```bash
# Option 1 — Python
python -m http.server 8080

# Option 2 — Node
npx serve .
```

Then open **http://localhost:8080** in your browser.

### Build the Android app

```bash
cd androidAPP
npx cap sync android
npx cap open android   # opens in Android Studio → Run ▶
```

---

##  Project Structure

```
AniStream/
├── index.html        # App shell (splash, header, tab bar, modal)
├── app.js            # Core logic: router, API, rendering, storage
├── styles.css        # Full design system & responsive UI
├── sw.js             # Service worker (offline caching)
├── manifest.json     # PWA manifest
├── icon.png          # App icon
└── androidAPP/       # Capacitor Android project
```

---

##  Roadmap

- [ ] User accounts & cloud-synced watchlist
- [ ] Episode progress tracking
- [ ] Seasonal anime calendar
- [ ] Recommendations engine
- [ ] iOS build (Capacitor)

---

##  Acknowledgements

- [Jikan API](https://jikan.moe) — open MyAnimeList API
- [MyAnimeList](https://myanimelist.net) — anime database
- [Capacitor](https://capacitorjs.com) — native runtime

---

##  License

Released under the **MIT License**. This is an unofficial fan project and is **not affiliated with MyAnimeList**. All anime data and images belong to their respective owners.

---

<div align="center">

Made with ❤️ for the anime community

</div>
