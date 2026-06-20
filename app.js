// ============================================================
// AniStream — Anime PWA Application
// ============================================================

const App = {
    // ---- Config ----
    API_BASE: 'https://api.jikan.moe/v4',
    CACHE_TTL: 5 * 60 * 1000,  // 5 min cache
    RATE_DELAY: 350,           // ms between API calls

    // ---- State ----
    currentPage: 'home',
    previousPage: null,
    pageParams: null,
    searchTimeout: null,
    cache: new Map(),
    lastApiCall: 0,
    heroAnime: null,
    synopsisExpanded: false,
    mylistTab: 'watchlist',

    // ---- Storage ----
    storage: {
        get(key, fallback = null) {
            try { const v = localStorage.getItem('ani_' + key); return v ? JSON.parse(v) : fallback; }
            catch { return fallback; }
        },
        set(key, val) {
            try { localStorage.setItem('ani_' + key, JSON.stringify(val)); } catch {}
        },
        remove(key) {
            try { localStorage.removeItem('ani_' + key); } catch {}
        }
    },

    // ---- Theme ----
    getTheme() { return this.storage.get('theme', 'dark'); },
    setTheme(t) {
        document.documentElement.setAttribute('data-theme', t);
        this.storage.set('theme', t);
        document.querySelector('meta[name="theme-color"]').content = t === 'dark' ? '#0a0a0f' : '#F5F5FC';
    },

    // ---- Watchlist ----
    getWatchlist() { return this.storage.get('watchlist', []); },
    isInWatchlist(id) { return this.getWatchlist().some(a => a.mal_id === id); },
    toggleWatchlist(anime) {
        let list = this.getWatchlist();
        const idx = list.findIndex(a => a.mal_id === anime.mal_id);
        if (idx >= 0) {
            list.splice(idx, 1);
            this.toast('Removed from watchlist');
        } else {
            list.unshift({ mal_id: anime.mal_id, title: anime.title, images: anime.images, score: anime.score, type: anime.type, episodes: anime.episodes, year: anime.year });
            this.toast('Added to watchlist ❤️');
        }
        this.storage.set('watchlist', list);
    },
    addToHistory(anime) {
        let hist = this.storage.get('history', []);
        hist = hist.filter(a => a.mal_id !== anime.mal_id);
        hist.unshift({ mal_id: anime.mal_id, title: anime.title, images: anime.images, score: anime.score, type: anime.type, episodes: anime.episodes, year: anime.year, viewedAt: Date.now() });
        if (hist.length > 50) hist = hist.slice(0, 50);
        this.storage.set('history', hist);
    },
    getHistory() { return this.storage.get('history', []); },

    // ---- API ----
    async api(endpoint, bustCache = false) {
        const cacheKey = endpoint;
        if (!bustCache && this.cache.has(cacheKey)) {
            const c = this.cache.get(cacheKey);
            if (Date.now() - c.time < this.CACHE_TTL) return c.data;
        }
        // Rate limiting
        const now = Date.now();
        const wait = this.RATE_DELAY - (now - this.lastApiCall);
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        this.lastApiCall = Date.now();

        try {
            const res = await fetch(this.API_BASE + endpoint);
            if (res.status === 429) {
                await new Promise(r => setTimeout(r, 1500));
                return this.api(endpoint, bustCache);
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            this.cache.set(cacheKey, { data: json, time: Date.now() });
            return json;
        } catch (e) {
            console.error('API Error:', e);
            return null;
        }
    },

    // ---- Toast ----
    toast(msg) {
        const el = document.getElementById('toast');
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
    },

    // ---- Modal ----
    openModal(html) {
        const modal = document.getElementById('modal');
        document.getElementById('modal-body').innerHTML = `<div class="modal-handle"></div>${html}`;
        modal.classList.remove('hidden');
    },
    closeModal() {
        document.getElementById('modal').classList.add('hidden');
    },

    // ---- Navigation ----
    navigate(page, params = null) {
        if (page === this.currentPage && !params) return;
        this.previousPage = this.currentPage;
        this.currentPage = page;
        this.pageParams = params;

        // Update tabs
        document.querySelectorAll('.tab').forEach(t => {
            t.classList.toggle('active', t.dataset.page === page);
        });

        // Header
        const title = document.getElementById('header-title');
        const backBtn = document.getElementById('back-btn');
        const searchBtn = document.getElementById('header-search');
        const isDetail = page === 'detail' || page === 'genre-detail';

        if (isDetail) {
            backBtn.classList.remove('hidden');
            title.classList.add('plain');
            title.textContent = page === 'detail' ? 'Details' : params?.name || 'Genre';
            searchBtn.classList.add('hidden');
        } else {
            backBtn.classList.add('hidden');
            searchBtn.classList.remove('hidden');
            title.classList.remove('plain');
            const titles = { home: 'AniStream', browse: 'Browse', search: 'Search', mylist: 'My List', settings: 'Settings' };
            title.textContent = titles[page] || 'AniStream';
            if (page === 'search') searchBtn.classList.add('hidden');
        }

        // Scroll to top
        document.getElementById('content').scrollTop = 0;

        // Render
        this.render();
    },

    goBack() {
        const back = this.previousPage || 'home';
        this.navigate(back);
    },

    // ---- Render ----
    render() {
        const c = document.getElementById('content');
        c.innerHTML = '<div class="page-enter">' + this.renderPage() + '</div>';
        this.bindPageEvents();
    },

    renderPage() {
        switch (this.currentPage) {
            case 'home': return this.renderHome();
            case 'browse': return this.renderBrowse();
            case 'search': return this.renderSearch();
            case 'mylist': return this.renderMyList();
            case 'settings': return this.renderSettings();
            case 'detail': return this.renderDetail();
            case 'genre-detail': return this.renderGenreDetail();
            default: return this.renderHome();
        }
    },

    // ---- Components ----
    starSvg: '<svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>',

    animeCard(a) {
        const img = a.images?.jpg?.image_url || a.images?.jpg?.large_image_url || '';
        const score = a.score ? `<div class="anime-card-score">${this.starSvg} ${a.score}</div>` : '';
        const type = a.type ? `<div class="anime-card-type">${a.type}</div>` : '';
        return `<div class="anime-card" onclick="App.openDetail(${a.mal_id})">
            <div class="anime-card-img">
                <img src="${img}" alt="${this.esc(a.title)}" loading="lazy" onerror="this.style.display='none'">
                ${score}${type}
            </div>
            <div class="anime-card-title">${this.esc(a.title)}</div>
            <div class="anime-card-sub">${a.episodes ? a.episodes + ' eps' : ''}${a.year ? ' · ' + a.year : ''}</div>
        </div>`;
    },

    gridCard(a) {
        const img = a.images?.jpg?.image_url || '';
        const score = a.score ? `<div class="grid-card-score">${this.starSvg} ${a.score}</div>` : '';
        return `<div class="grid-card" onclick="App.openDetail(${a.mal_id})">
            <div class="grid-card-img">
                <img src="${img}" alt="${this.esc(a.title)}" loading="lazy" onerror="this.style.display='none'">
                ${score}
            </div>
            <div class="grid-card-title">${this.esc(a.title)}</div>
        </div>`;
    },

    skeletonCards(n = 5) {
        return Array(n).fill('<div class="skeleton skeleton-card"></div>').join('');
    },

    section(title, contentId, moreAction = '') {
        const more = moreAction ? `<button class="section-more" onclick="${moreAction}">See All <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></button>` : '';
        return `<div class="section">
            <div class="section-header">
                <h2 class="section-title">${title}</h2>${more}
            </div>
            <div class="h-scroll" id="${contentId}">${this.skeletonCards()}</div>
        </div>`;
    },

    esc(s) {
        if (!s) return '';
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    },

    // ---- HOME PAGE ----
    renderHome() {
        return `
            <div id="hero-container"></div>
            ${this.section('🔥 Trending Now', 'sec-trending')}
            ${this.section('⭐ Top Rated', 'sec-top')}
            ${this.section('📺 Airing Now', 'sec-airing')}
            ${this.section('🎬 Upcoming', 'sec-upcoming')}
        `;
    },

    async loadHome() {
        // Hero
        this.loadHero();
        // Sections
        this.loadSection('/top/anime?filter=airing&limit=15', 'sec-trending');
        await new Promise(r => setTimeout(r, 400));
        this.loadSection('/top/anime?filter=bypopularity&limit=15', 'sec-top');
        await new Promise(r => setTimeout(r, 400));
        this.loadSection('/seasons/now?limit=15', 'sec-airing');
        await new Promise(r => setTimeout(r, 400));
        this.loadSection('/seasons/upcoming?limit=15', 'sec-upcoming');
    },

    async loadHero() {
        const res = await this.api('/top/anime?filter=airing&limit=8');
        if (!res?.data?.length) return;
        const hero = res.data[Math.floor(Math.random() * Math.min(5, res.data.length))];
        this.heroAnime = hero;
        const container = document.getElementById('hero-container');
        if (!container) return;
        const img = hero.images?.jpg?.large_image_url || hero.images?.jpg?.image_url || '';
        const genres = (hero.genres || []).map(g => g.name).slice(0, 3).join(' · ');
        container.innerHTML = `
            <div class="hero" onclick="App.openDetail(${hero.mal_id})">
                <div class="hero-bg" style="background-image:url('${img}')"></div>
                <div class="hero-overlay"></div>
                <div class="hero-content">
                    <div class="hero-badge">🔥 Trending</div>
                    <h2 class="hero-title">${this.esc(hero.title)}</h2>
                    <div class="hero-meta">
                        ${hero.score ? `<span class="hero-meta-item">${this.starSvg} ${hero.score}</span>` : ''}
                        ${hero.type ? `<span class="hero-meta-item">${hero.type}</span>` : ''}
                        ${hero.episodes ? `<span class="hero-meta-item">${hero.episodes} eps</span>` : ''}
                        ${genres ? `<span class="hero-meta-item">${genres}</span>` : ''}
                    </div>
                    <div class="hero-actions">
                        <button class="btn btn-primary btn-small" onclick="event.stopPropagation();App.openDetail(${hero.mal_id})">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                            Details
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="event.stopPropagation();App.toggleWatchlist(App.heroAnime);this.textContent=App.isInWatchlist(${hero.mal_id})?'✓ Listed':'+ My List'">
                            ${this.isInWatchlist(hero.mal_id) ? '✓ Listed' : '+ My List'}
                        </button>
                    </div>
                </div>
            </div>`;
    },

    async loadSection(endpoint, containerId) {
        const el = document.getElementById(containerId);
        if (!el) return;
        const res = await this.api(endpoint);
        if (!res?.data?.length) { el.innerHTML = '<p style="padding:0 4px;color:var(--text3)">No data available</p>'; return; }
        el.innerHTML = res.data.map(a => this.animeCard(a)).join('');
    },

    // ---- BROWSE PAGE ----
    genres: [
        { id: 1, name: 'Action', icon: '⚔️', color: '#E94560' },
        { id: 2, name: 'Adventure', icon: '🗺️', color: '#FF6B6B' },
        { id: 4, name: 'Comedy', icon: '😂', color: '#FFD93D' },
        { id: 8, name: 'Drama', icon: '🎭', color: '#6C5CE7' },
        { id: 10, name: 'Fantasy', icon: '🧙', color: '#A29BFE' },
        { id: 14, name: 'Horror', icon: '👻', color: '#2D3436' },
        { id: 22, name: 'Romance', icon: '💕', color: '#FD79A8' },
        { id: 24, name: 'Sci-Fi', icon: '🚀', color: '#00CEC9' },
        { id: 30, name: 'Sports', icon: '⚽', color: '#00B894' },
        { id: 36, name: 'Slice of Life', icon: '🌸', color: '#FF9FF3' },
        { id: 7, name: 'Mystery', icon: '🔍', color: '#636E72' },
        { id: 25, name: 'Shoujo', icon: '🌙', color: '#FD79A8' },
        { id: 27, name: 'Shounen', icon: '🔥', color: '#E17055' },
        { id: 46, name: 'Award Winning', icon: '🏆', color: '#FDCB6E' },
        { id: 18, name: 'Mecha', icon: '🤖', color: '#74B9FF' },
        { id: 37, name: 'Supernatural', icon: '✨', color: '#A29BFE' },
    ],

    renderBrowse() {
        const tiles = this.genres.map(g => `
            <div class="genre-tile" onclick="App.navigate('genre-detail',{id:${g.id},name:'${g.name}'})" style="border-left:3px solid ${g.color}">
                <div class="genre-tile-icon">${g.icon}</div>
                <div class="genre-tile-name">${g.name}</div>
            </div>
        `).join('');
        return `
            <div style="padding:18px 18px 10px">
                <h2 style="font-size:24px;font-weight:800;letter-spacing:-0.3px">Genres</h2>
                <p style="font-size:14px;color:var(--text3);margin-top:4px">Explore anime by genre</p>
            </div>
            <div class="genre-grid" style="margin-top:6px">${tiles}</div>
            <div style="height:30px"></div>
        `;
    },

    // ---- GENRE DETAIL ----
    renderGenreDetail() {
        return `
            <div style="padding:18px">
                <h2 style="font-size:22px;font-weight:800">${this.esc(this.pageParams?.name)} Anime</h2>
            </div>
            <div class="grid-3" id="genre-results">${this.skeletonCards(6)}</div>
            <div style="height:20px"></div>
        `;
    },

    async loadGenreDetail() {
        const el = document.getElementById('genre-results');
        if (!el || !this.pageParams?.id) return;
        const res = await this.api(`/anime?genres=${this.pageParams.id}&order_by=score&sort=desc&limit=24`);
        if (!res?.data?.length) { el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">No anime found</div></div>'; return; }
        el.innerHTML = res.data.map(a => this.gridCard(a)).join('');
    },

    // ---- SEARCH PAGE ----
    renderSearch() {
        return `
            <div class="search-wrap">
                <div class="search-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    <input type="text" id="search-input" placeholder="Search anime..." autocomplete="off" autofocus>
                </div>
            </div>
            <div class="search-filters" id="search-filters">
                <button class="filter-chip active" data-filter="all" onclick="App.setSearchFilter('all')">All</button>
                <button class="filter-chip" data-filter="tv" onclick="App.setSearchFilter('tv')">TV</button>
                <button class="filter-chip" data-filter="movie" onclick="App.setSearchFilter('movie')">Movies</button>
                <button class="filter-chip" data-filter="ova" onclick="App.setSearchFilter('ova')">OVA</button>
                <button class="filter-chip" data-filter="special" onclick="App.setSearchFilter('special')">Special</button>
                <button class="filter-chip" data-filter="ona" onclick="App.setSearchFilter('ona')">ONA</button>
            </div>
            <div id="search-results"></div>
            <div id="search-empty" class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <div class="empty-state-title">Discover Anime</div>
                <div class="empty-state-desc">Search for your favorite anime by title</div>
            </div>
        `;
    },

    searchFilter: 'all',

    setSearchFilter(f) {
        this.searchFilter = f;
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('active', c.dataset.filter === f));
        const input = document.getElementById('search-input');
        if (input?.value.trim()) this.doSearch(input.value.trim());
    },

    async doSearch(q) {
        const results = document.getElementById('search-results');
        const empty = document.getElementById('search-empty');
        if (!results) return;
        if (!q) { results.innerHTML = ''; empty.style.display = ''; return; }
        empty.style.display = 'none';
        results.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
        let endpoint = `/anime?q=${encodeURIComponent(q)}&limit=20&sfw=true`;
        if (this.searchFilter !== 'all') endpoint += `&type=${this.searchFilter}`;
        const res = await this.api(endpoint);
        if (!res?.data?.length) {
            results.innerHTML = '<div class="empty-state"><div class="empty-state-icon">😢</div><div class="empty-state-title">No results</div><div class="empty-state-desc">Try a different search term</div></div>';
            return;
        }
        results.innerHTML = '<div class="grid-3">' + res.data.map(a => this.gridCard(a)).join('') + '</div>';
    },

    // ---- DETAIL PAGE ----
    renderDetail() {
        return `<div id="detail-loading" class="spinner-wrap" style="padding-top:100px"><div class="spinner"></div></div><div id="detail-content"></div>`;
    },

    async loadDetail() {
        const id = this.pageParams;
        if (!id) return;
        const res = await this.api(`/anime/${id}/full`);
        const el = document.getElementById('detail-content');
        const loader = document.getElementById('detail-loading');
        if (!res?.data || !el) { if (loader) loader.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">Failed to load</div></div>'; return; }
        if (loader) loader.style.display = 'none';

        const a = res.data;
        this.addToHistory(a);
        const img = a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || '';
        const inList = this.isInWatchlist(a.mal_id);
        const genres = (a.genres || []).map(g => `<span class="detail-genre">${g.name}</span>`).join('');
        const trailer = a.trailer?.embed_url ? `
            <div class="trailer-wrap">
                <div class="detail-section-title" style="padding:0 0 10px">🎬 Trailer</div>
                <div class="trailer-frame">
                    <iframe src="${a.trailer.embed_url}?autoplay=0" allowfullscreen loading="lazy"></iframe>
                </div>
            </div>` : '';

        el.innerHTML = `
            <div class="detail-hero">
                <img class="detail-hero-bg" src="${img}" alt="" onerror="this.style.display='none'">
                <div class="detail-hero-gradient"></div>
            </div>
            <div class="detail-info">
                <div class="detail-poster"><img src="${img}" alt="${this.esc(a.title)}" onerror="this.style.display='none'"></div>
                <div class="detail-meta">
                    <h1 class="detail-title">${this.esc(a.title)}</h1>
                    ${a.title_japanese ? `<p class="detail-sub">${this.esc(a.title_japanese)}</p>` : ''}
                    <div class="detail-stats">
                        ${a.score ? `<span class="detail-stat star">${this.starSvg} ${a.score}</span>` : ''}
                        <span class="detail-stat">👥 #${a.rank || '—'}</span>
                        ${a.episodes ? `<span class="detail-stat">📺 ${a.episodes} eps</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="detail-actions">
                <button class="btn btn-primary" id="detail-watchlist-btn" onclick="App.toggleWatchlistDetail(${a.mal_id})">
                    ${inList ? '✓ In Watchlist' : '♡ Add to List'}
                </button>
                <button class="btn btn-secondary btn-icon" onclick="App.shareAnime(${a.mal_id},'${this.esc(a.title).replace(/'/g,"\\'")}')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>
                </button>
            </div>
            ${genres ? `<div class="detail-genres">${genres}</div>` : ''}
            ${a.synopsis ? `
                <div class="detail-section">
                    <div class="detail-section-title">Synopsis</div>
                    <p class="detail-synopsis clamped" id="synopsis-text">${this.esc(a.synopsis)}</p>
                    <div class="detail-read-more" id="read-more-btn" onclick="App.toggleSynopsis()">Read more</div>
                </div>` : ''}
            ${trailer}
            <div class="detail-section">
                <div class="detail-section-title">Information</div>
                <div class="detail-info-grid">
                    ${this.infoItem('Type', a.type || '—')}
                    ${this.infoItem('Status', a.status || '—')}
                    ${this.infoItem('Aired', a.aired?.string || '—')}
                    ${this.infoItem('Source', a.source || '—')}
                    ${this.infoItem('Rating', a.rating || '—')}
                    ${this.infoItem('Duration', a.duration || '—')}
                    ${this.infoItem('Studios', (a.studios||[]).map(s=>s.name).join(', ') || '—')}
                    ${this.infoItem('Members', a.members ? a.members.toLocaleString() : '—')}
                </div>
            </div>
            <div style="height:30px"></div>
        `;
        this._detailAnimeData = a;
    },

    infoItem(label, value) {
        return `<div class="detail-info-item"><div class="detail-info-label">${label}</div><div class="detail-info-value">${this.esc(String(value))}</div></div>`;
    },

    toggleSynopsis() {
        const el = document.getElementById('synopsis-text');
        const btn = document.getElementById('read-more-btn');
        if (!el) return;
        const clamped = el.classList.toggle('clamped');
        if (btn) btn.textContent = clamped ? 'Read more' : 'Show less';
    },

    toggleWatchlistDetail(id) {
        if (this._detailAnimeData) {
            this.toggleWatchlist(this._detailAnimeData);
            const btn = document.getElementById('detail-watchlist-btn');
            if (btn) btn.innerHTML = this.isInWatchlist(id) ? '✓ In Watchlist' : '♡ Add to List';
        }
    },

    shareAnime(id, title) {
        const url = `https://myanimelist.net/anime/${id}`;
        if (navigator.share) {
            navigator.share({ title: title, text: `Check out ${title} on MyAnimeList!`, url });
        } else {
            navigator.clipboard.writeText(url).then(() => this.toast('Link copied! 📋'));
        }
    },

    openDetail(id) {
        this.navigate('detail', id);
    },

    // ---- MY LIST PAGE ----
    renderMyList() {
        const watchlist = this.getWatchlist();
        const history = this.getHistory();
        const activeTab = this.mylistTab;
        const items = activeTab === 'watchlist' ? watchlist : history;

        const tabBar = `
            <div class="mylist-tabs">
                <button class="mylist-tab ${activeTab === 'watchlist' ? 'active' : ''}" onclick="App.mylistTab='watchlist';App.render()">Watchlist (${watchlist.length})</button>
                <button class="mylist-tab ${activeTab === 'history' ? 'active' : ''}" onclick="App.mylistTab='history';App.render()">History (${history.length})</button>
            </div>`;

        if (!items.length) {
            const emptyMsg = activeTab === 'watchlist'
                ? { icon: '💔', title: 'Your watchlist is empty', desc: 'Browse anime and add them to your list' }
                : { icon: '👀', title: 'No watch history yet', desc: 'Anime you view will appear here' };
            return tabBar + `<div class="empty-state"><div class="empty-state-icon">${emptyMsg.icon}</div><div class="empty-state-title">${emptyMsg.title}</div><div class="empty-state-desc">${emptyMsg.desc}</div></div>`;
        }

        const listHtml = items.map(a => {
            const img = a.images?.jpg?.image_url || '';
            const removeBtn = activeTab === 'watchlist'
                ? `<button class="list-item-remove" onclick="event.stopPropagation();App.removeFromWatchlist(${a.mal_id})" title="Remove"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>`
                : '';
            return `<div class="list-item" onclick="App.openDetail(${a.mal_id})">
                <div class="list-item-img"><img src="${img}" alt="" loading="lazy" onerror="this.style.display='none'"></div>
                <div class="list-item-info">
                    <div class="list-item-title">${this.esc(a.title)}</div>
                    <div class="list-item-meta">${a.type || ''}${a.episodes ? ' · ' + a.episodes + ' eps' : ''}${a.year ? ' · ' + a.year : ''}</div>
                    ${a.score ? `<div class="list-item-score">${this.starSvg} ${a.score}</div>` : ''}
                </div>
                ${removeBtn}
            </div>`;
        }).join('');

        return tabBar + listHtml + '<div style="height:20px"></div>';
    },

    removeFromWatchlist(id) {
        let list = this.getWatchlist();
        list = list.filter(a => a.mal_id !== id);
        this.storage.set('watchlist', list);
        this.toast('Removed from watchlist');
        this.render();
    },

    // ---- SETTINGS PAGE ----
    renderSettings() {
        const theme = this.getTheme();
        const isDark = theme === 'dark';
        const wlCount = this.getWatchlist().length;
        const histCount = this.getHistory().length;

        return `
            <div style="padding:20px 18px 6px">
                <h2 style="font-size:28px;font-weight:900;letter-spacing:-0.5px">Settings</h2>
            </div>

            <div class="settings-group" style="margin-top:14px">
                <div class="settings-group-title">Appearance</div>
                <div class="settings-item" onclick="App.toggleTheme()">
                    <div class="settings-item-left">
                        <div class="settings-item-icon" style="background:var(--surface2)">${isDark ? '🌙' : '☀️'}</div>
                        <div>
                            <div class="settings-item-label">Dark Mode</div>
                            <div class="settings-item-desc">Switch between dark and light theme</div>
                        </div>
                    </div>
                    <div class="toggle ${isDark ? 'on' : ''}" id="theme-toggle"></div>
                </div>
            </div>

            <div class="settings-group">
                <div class="settings-group-title">Data</div>
                <div class="settings-item" onclick="App.navigate('mylist')">
                    <div class="settings-item-left">
                        <div class="settings-item-icon" style="background:var(--primary-glow)">❤️</div>
                        <div>
                            <div class="settings-item-label">Watchlist</div>
                            <div class="settings-item-desc">${wlCount} anime saved</div>
                        </div>
                    </div>
                    <div class="settings-item-right">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                    </div>
                </div>
                <div class="settings-item" onclick="App.navigate('mylist')">
                    <div class="settings-item-left">
                        <div class="settings-item-icon" style="background:var(--secondary-glow)">📜</div>
                        <div>
                            <div class="settings-item-label">Watch History</div>
                            <div class="settings-item-desc">${histCount} anime viewed</div>
                        </div>
                    </div>
                    <div class="settings-item-right">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                    </div>
                </div>
                <div class="settings-item" onclick="App.clearAllData()">
                    <div class="settings-item-left">
                        <div class="settings-item-icon" style="background:rgba(255,71,87,0.15)">🗑️</div>
                        <div>
                            <div class="settings-item-label" style="color:var(--danger)">Clear All Data</div>
                            <div class="settings-item-desc">Remove watchlist, history, and cache</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="settings-group">
                <div class="settings-group-title">About</div>
                <div class="settings-item">
                    <div class="settings-item-left">
                        <div class="settings-item-icon" style="background:var(--surface2)">📱</div>
                        <div>
                            <div class="settings-item-label">AniStream</div>
                            <div class="settings-item-desc">Version 1.0.0 — Your Anime Universe</div>
                        </div>
                    </div>
                </div>
                <div class="settings-item" onclick="window.open('https://jikan.moe','_blank')">
                    <div class="settings-item-left">
                        <div class="settings-item-icon" style="background:var(--surface2)">⚡</div>
                        <div>
                            <div class="settings-item-label">Powered by Jikan API</div>
                            <div class="settings-item-desc">Unofficial MyAnimeList API</div>
                        </div>
                    </div>
                    <div class="settings-item-right">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
                    </div>
                </div>
                <div class="settings-item" id="install-btn" style="display:none" onclick="App.installPWA()">
                    <div class="settings-item-left">
                        <div class="settings-item-icon" style="background:var(--success);color:#fff">📲</div>
                        <div>
                            <div class="settings-item-label">Install App</div>
                            <div class="settings-item-desc">Add to home screen for the full experience</div>
                        </div>
                    </div>
                </div>
            </div>
            <div style="height:40px"></div>
        `;
    },

    toggleTheme() {
        const current = this.getTheme();
        const next = current === 'dark' ? 'light' : 'dark';
        this.setTheme(next);
        this.render();
    },

    clearAllData() {
        this.openModal(`
            <h3 style="font-size:18px;font-weight:700;margin-bottom:8px">Clear All Data?</h3>
            <p style="font-size:14px;color:var(--text2);line-height:1.5;margin-bottom:20px">This will remove your watchlist, history, and all cached data. This action cannot be undone.</p>
            <div style="display:flex;gap:10px">
                <button class="btn btn-secondary" style="flex:1" onclick="App.closeModal()">Cancel</button>
                <button class="btn btn-primary" style="flex:1;background:var(--danger)" onclick="App.confirmClearData()">Clear Data</button>
            </div>
        `);
    },

    confirmClearData() {
        this.storage.remove('watchlist');
        this.storage.remove('history');
        this.cache.clear();
        this.closeModal();
        this.toast('All data cleared 🧹');
        this.render();
    },

    // ---- PWA Install ----
    deferredPrompt: null,
    installPWA() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            this.deferredPrompt.userChoice.then(result => {
                if (result.outcome === 'accepted') this.toast('App installed! 🎉');
                this.deferredPrompt = null;
            });
        }
    },

    // ---- Page Events ----
    bindPageEvents() {
        // Search input
        if (this.currentPage === 'search') {
            const input = document.getElementById('search-input');
            if (input) {
                input.addEventListener('input', () => {
                    clearTimeout(this.searchTimeout);
                    this.searchTimeout = setTimeout(() => this.doSearch(input.value.trim()), 400);
                });
                setTimeout(() => input.focus(), 100);
            }
        }
        // Load data for pages
        if (this.currentPage === 'home') this.loadHome();
        if (this.currentPage === 'detail') this.loadDetail();
        if (this.currentPage === 'genre-detail') this.loadGenreDetail();

        // Show install button
        if (this.currentPage === 'settings' && this.deferredPrompt) {
            const btn = document.getElementById('install-btn');
            if (btn) btn.style.display = '';
        }
    },

    // ---- Init ----
    init() {
        // Apply theme
        this.setTheme(this.getTheme());

        // PWA install prompt
        window.addEventListener('beforeinstallprompt', e => {
            e.preventDefault();
            this.deferredPrompt = e;
        });

        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        }

        // Splash screen
        setTimeout(() => {
            document.getElementById('splash').classList.add('hide');
            document.getElementById('app').classList.remove('hidden');
            this.navigate('home');
            setTimeout(() => {
                const splash = document.getElementById('splash');
                if (splash) splash.remove();
            }, 600);
        }, 1800);
    }
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
