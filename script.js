// The final, working script.js for live data AND live images on GitHub Pages

document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    let allPodcasts = [];
    let currentPodcast = null;
    let currentEpisodeIndex = -1;
    let favorites = JSON.parse(localStorage.getItem('podcastFavorites')) || [];
    let playedEpisodes = JSON.parse(localStorage.getItem('podcastPlayed')) || {};

    // --- DOM ELEMENTS ---
    const loadingIndicator = document.getElementById('loading-indicator');
    const homeView = document.getElementById('home-view');
    const detailView = document.getElementById('podcast-detail-view');
    const favoritesGrid = document.getElementById('favorites-grid');
    const topPodcastsList = document.getElementById('top-podcasts-list');
    
    // Player elements
    const audioPlayer = document.getElementById('audio-player');
    const playerPodcastInfo = document.getElementById('player-podcast-info');
    const playerEpisodeLogo = document.getElementById('player-episode-logo');
    const playerEpisodeName = document.getElementById('player-episode-name');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    // ===== NEW: Progress Bar Elements =====
    const progressBar = document.getElementById('progress-bar');
    const currentTimeSpan = document.getElementById('current-time');
    const totalDurationSpan = document.getElementById('total-duration');


    // --- SVG ICONS ---
    const ICONS = {};
    ICONS.play = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8,5.14V19.14L19,12.14L8,5.14Z" /></svg>`;
    ICONS.pause = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M14,19H18V5H14M6,19H10V5H6V19Z" /></svg>`;
    ICONS.prev = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6,18V6H8V18H6M9.5,12L18,6V18L9.5,12Z" /></svg>`;
    ICONS.next = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16,18H18V6H16M6,18L14.5,12L6,6V18Z" /></svg>`;
    
    // --- YOUR PERSONAL PROXY ---
    const CORS_PROXY_API = 'https://podcast.appecta.workers.dev/?url=';

    // --- HELPER FUNCTIONS ---
    const getProxiedUrl = (url) => {
        if (!url || url.trim() === '') return 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
        return `${CORS_PROXY_API}${encodeURIComponent(url)}`;
    };
    const getElementText = (parent, tagName) => {
        const element = parent.getElementsByTagName(tagName)[0];
        return element ? element.textContent.trim() : '';
    };
    
    // ===== NEW: Time Formatting Helper =====
    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
    };

    // --- PARSING FUNCTION ---
    function parsePodcastFromXML(xmlString, rank) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
        if (xmlDoc.querySelector('parsererror')) { console.error('Failed to parse XML for rank:', rank); return null; }
        const channel = xmlDoc.getElementsByTagName('channel')[0];
        if (!channel) return null;
        const itunesNamespace = "http://www.itunes.com/dtds/podcast-1.0.dtd";
        let mainImage = '';
        const itunesImage = channel.getElementsByTagNameNS(itunesNamespace, 'image')[0];
        if (itunesImage) { mainImage = itunesImage.getAttribute('href');
        } else { const standardImage = channel.getElementsByTagName('image')[0]; if (standardImage) { mainImage = getElementText(standardImage, 'url'); } }
        const items = Array.from(channel.getElementsByTagName('item')).map(item => {
            const enclosure = item.getElementsByTagName('enclosure')[0];
            let episodeThumbnail = '';
            const itemItunesImage = item.getElementsByTagNameNS(itunesNamespace, 'image')[0];
            if (itemItunesImage) { episodeThumbnail = itemItunesImage.getAttribute('href'); }
            return {
                title: getElementText(item, 'title'), description: getElementText(item, 'description'), guid: getElementText(item, 'guid'),
                enclosure: { link: enclosure ? enclosure.getAttribute('url') : '', type: enclosure ? enclosure.getAttribute('type') : '', length: enclosure ? enclosure.getAttribute('length') : 0, },
                thumbnail: episodeThumbnail || mainImage,
            };
        });
        return {
            status: 'ok',
            feed: { rank, title: getElementText(channel, 'title'), description: getElementText(channel, 'description'), image: mainImage },
            items,
        };
    }

    async function fetchPodcasts() {
        try {
            const response = await fetch('rss.txt');
            const text = await response.text();
            const rssUrls = text.split('\n').filter(url => url.trim() !== '');
            const podcastPromises = rssUrls.map((url, index) =>
                fetch(`${CORS_PROXY_API}${encodeURIComponent(url)}`)
                    .then(res => res.ok ? res.text() : Promise.reject(`Proxy fetch failed: ${res.status}`))
                    .then(xmlString => parsePodcastFromXML(xmlString, index + 1))
                    .catch(error => { console.error(`Error processing feed ${url}:`, error); return null; })
            );
            allPodcasts = (await Promise.all(podcastPromises)).filter(p => p !== null);
            renderHomeView();
            loadingIndicator.classList.add('hidden');
        } catch (error) {
            console.error("Critical error:", error);
            loadingIndicator.innerText = 'Podcast verileri yüklenemedi';
        }
    }

    // --- RENDER FUNCTIONS ---
    function renderHomeView() { renderTopPodcasts(); renderFavorites(); }
    function renderTopPodcasts() {
        topPodcastsList.innerHTML = '';
        if (allPodcasts.length === 0) { topPodcastsList.innerHTML = `<p class="placeholder">Podcastler yüklenemedi.</p>`; return; }
        allPodcasts.sort((a, b) => a.feed.rank - b.feed.rank).forEach(podcast => {
            const isFavorited = favorites.includes(podcast.feed.rank);
            const item = document.createElement('div');
            item.className = 'podcast-list-item';
            item.innerHTML = `<span class="rank">${podcast.feed.rank}</span><img src="${getProxiedUrl(podcast.feed.image)}" alt="${podcast.feed.title} Logo"><div class="podcast-info"><div class="podcast-name">${podcast.feed.title}</div></div><button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-rank="${podcast.feed.rank}">♡</button>`;
            item.addEventListener('click', () => showDetailView(podcast.feed.rank));
            item.querySelector('.favorite-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(podcast.feed.rank); });
            topPodcastsList.appendChild(item);
        });
    }
    function renderFavorites() {
        favoritesGrid.innerHTML = '';
        const favoritePodcasts = allPodcasts.filter(p => favorites.includes(p.feed.rank));
        if (favoritePodcasts.length === 0) { favoritesGrid.innerHTML = '<p class="placeholder">Hiç favorin yok. Favorilerine podcast eklemek için ♡ butonuna tıkla.</p>'; return; }
        favoritePodcasts.forEach(podcast => {
            const card = document.createElement('div');
            card.className = 'podcast-card';
            card.innerHTML = `<img src="${getProxiedUrl(podcast.feed.image)}" alt="${podcast.feed.title} Logo"><div class="podcast-name">${podcast.feed.title}</div>`;
            card.addEventListener('click', () => showDetailView(podcast.feed.rank));
            favoritesGrid.appendChild(card);
        });
    }
    function showDetailView(rank) {
        currentPodcast = allPodcasts.find(p => p.feed.rank === rank);
        if (!currentPodcast) return;
        const isFavorited = favorites.includes(currentPodcast.feed.rank);
        detailView.innerHTML = `
            <div class="back-button" id="back-to-home">‹</div>
            <div class="podcast-detail-header card">
                <img src="${getProxiedUrl(currentPodcast.feed.image)}" alt="${currentPodcast.feed.title} Logo">
                <div class="info">
                    <h1>${currentPodcast.feed.title}</h1>
                    <p class="description">${currentPodcast.feed.description || 'Açıklama bulunamadı.'}</p>
                    <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-rank="${currentPodcast.feed.rank}">♡</button>
                </div>
            </div>
            <h2>Tüm bölümler</h2>
            <div class="episode-list">${currentPodcast.items.map((episode, index) => `<div class="episode-list-item" data-episode-index="${index}"><span class="ep-number">${currentPodcast.items.length - index}</span><div class="ep-name">${episode.title}</div><div class="played-indicator ${playedEpisodes[episode.guid] ? 'played' : ''}">${playedEpisodes[episode.guid] ? '✓' : ''}</div></div>`).join('')}</div>`;
        homeView.classList.add('hidden');
        detailView.classList.remove('hidden');
        window.scrollTo(0, 0);
        document.getElementById('back-to-home').addEventListener('click', () => { detailView.classList.add('hidden'); homeView.classList.remove('hidden'); window.scrollTo(0, 0); });
        detailView.querySelector('.favorite-btn').addEventListener('click', () => toggleFavorite(currentPodcast.feed.rank));
        detailView.querySelectorAll('.episode-list-item').forEach(item => { item.addEventListener('click', (e) => { const index = parseInt(e.currentTarget.dataset.episodeIndex); playEpisode(index); }); });
    }

    // --- PLAYER AND ACTION FUNCTIONS ---
    function updatePlayerUI() {
        if (!currentPodcast || currentEpisodeIndex === -1) return;
        const episode = currentPodcast.items[currentEpisodeIndex];
        const podcastImageUrl = currentPodcast.feed.image;
        const episodeImageUrl = episode.thumbnail || podcastImageUrl;
        playerPodcastInfo.innerHTML = `<img src="${getProxiedUrl(podcastImageUrl)}" alt="${currentPodcast.feed.title} Logo"><span>${currentPodcast.feed.title}</span>`;
        playerEpisodeLogo.src = getProxiedUrl(episodeImageUrl);
        playerEpisodeLogo.classList.remove('placeholder-bg');
        playerEpisodeName.innerText = episode.title;
    }
    function playEpisode(index) {
        if (!currentPodcast || index < 0 || index >= currentPodcast.items.length) return;
        currentEpisodeIndex = index;
        const episode = currentPodcast.items[index];
        if (!playedEpisodes[episode.guid]) {
            playedEpisodes[episode.guid] = true;
            localStorage.setItem('podcastPlayed', JSON.stringify(playedEpisodes));
            const episodeNode = detailView.querySelector(`[data-episode-index="${index}"] .played-indicator`);
            if (episodeNode) { episodeNode.classList.add('played'); episodeNode.innerText = '✓'; }
        }
        audioPlayer.src = episode.enclosure.link;
        audioPlayer.play();
        updatePlayerUI();
    }
    function toggleFavorite(rank) {
        const index = favorites.indexOf(rank);
        if (index > -1) { favorites.splice(index, 1); } else { favorites.push(rank); }
        localStorage.setItem('podcastFavorites', JSON.stringify(favorites));
        renderHomeView();
        if (!detailView.classList.contains('hidden') && currentPodcast && currentPodcast.feed.rank === rank) { const isFavorited = favorites.includes(rank); detailView.querySelector('.favorite-btn').classList.toggle('favorited', isFavorited); }
    }
    function handlePlayPause() { if (audioPlayer.paused) { if (audioPlayer.src) { audioPlayer.play(); } } else { audioPlayer.pause(); } }
    function handleNext() { if (currentPodcast) { let nextIndex = currentEpisodeIndex + 1; if (nextIndex < currentPodcast.items.length) { playEpisode(nextIndex); } } }
    function handlePrev() { if (currentPodcast) { let prevIndex = currentEpisodeIndex - 1; if (prevIndex >= 0) { playEpisode(prevIndex); } } }

    // --- INITIALIZE ---
    function initializePlayer() {
        playPauseBtn.innerHTML = ICONS.play;
        prevBtn.innerHTML = ICONS.prev;
        nextBtn.innerHTML = ICONS.next;
        playPauseBtn.addEventListener('click', handlePlayPause);
        nextBtn.addEventListener('click', handleNext); 
        prevBtn.addEventListener('click', handlePrev);
        audioPlayer.addEventListener('play', () => playPauseBtn.innerHTML = ICONS.pause);
        audioPlayer.addEventListener('pause', () => playPauseBtn.innerHTML = ICONS.play);
        audioPlayer.addEventListener('ended', handleNext);

        // ===== NEW: Progress Bar Event Listeners =====
        audioPlayer.addEventListener('timeupdate', () => {
            if (audioPlayer.duration) {
                progressBar.value = audioPlayer.currentTime;
                currentTimeSpan.textContent = formatTime(audioPlayer.currentTime);
            }
        });
        audioPlayer.addEventListener('loadedmetadata', () => {
            progressBar.max = audioPlayer.duration;
            totalDurationSpan.textContent = formatTime(audioPlayer.duration);
        });
        progressBar.addEventListener('input', () => {
            audioPlayer.currentTime = progressBar.value;
        });
    }
    initializePlayer();
    fetchPodcasts();
});