// Series Info Page Logic

document.addEventListener('DOMContentLoaded', initSeriesInfo);

// Extract ID from URL
const urlParams = new URLSearchParams(window.location.search);
const SERIES_ID = urlParams.get('id');

let videoPlayer; // YT Player instance

// DOM Elements
const episodesList = document.getElementById('episodes-list');
const seasonSelect = document.getElementById('season-select');
const actorsGrid = document.getElementById('actors-grid');
const recommendationsGrid = document.getElementById('recommendations-grid');

async function initSeriesInfo() {
    if (!SERIES_ID) {
        window.location.href = 'index.html'; // Fallback
        return;
    }

    try {
        const details = await getTvDetails(SERIES_ID);
        const videos = await getTvVideos(SERIES_ID);
        const images = await getTvImages(SERIES_ID);
        const credits = await getTvCredits(SERIES_ID);
        const recommendations = await getTvRecommendations(SERIES_ID);

        // Render Hero
        renderHero(details, videos, images);
        setupInteraction();

        // Render Actors
        renderActors(credits.cast);

        // Render Recommendations
        const arabicPattern = /[\u0600-\u06FF]/;
        const nsfwPattern = /\b(erotic|erotica|softcore|porn|xxx|hentai|uncensored|nudity|18\+|adult|rape|sexual)\b/i;

        const validRecs = recommendations.results.filter(item =>
            !item.adult &&
            item.original_language !== 'ar' &&
            item.poster_path &&
            !arabicPattern.test(item.name || '') &&
            !arabicPattern.test(item.overview || '') &&
            !nsfwPattern.test(item.name || '') &&
            !nsfwPattern.test(item.overview || '')
        );

        renderRecommendations(validRecs);

        // Initialize Episodes (Latest season default)
        setupSeasonSelector(details.seasons);
        if (details.seasons.length > 0) {
            // Find latest season by max season_number
            const latestSeason = details.seasons.reduce((prev, current) => (prev.season_number > current.season_number) ? prev : current);

            await loadSeason(latestSeason.season_number);
            seasonSelect.value = latestSeason.season_number;
        }

    } catch (e) {
        console.error("Error loading series info:", e);
    }
}

// --- FETCHERS ---
async function getTvDetails(id) {
    const res = await fetch(`${BASE_URL}/tv/${id}?api_key=${API_KEY}&language=en-US`);
    return await res.json();
}

async function getTvVideos(id) {
    const res = await fetch(`${BASE_URL}/tv/${id}/videos?api_key=${API_KEY}&language=en-US`);
    return await res.json();
}

async function getTvImages(id) {
    const res = await fetch(`${BASE_URL}/tv/${id}/images?api_key=${API_KEY}&include_image_language=en,null`);
    return await res.json();
}

async function getTvCredits(id) {
    const res = await fetch(`${BASE_URL}/tv/${id}/credits?api_key=${API_KEY}&language=en-US`);
    return await res.json();
}

async function getTvRecommendations(id) {
    const res = await fetch(`${BASE_URL}/tv/${id}/recommendations?api_key=${API_KEY}&language=en-US&page=1`);
    return await res.json();
}

async function getTvSeason(id, seasonNum) {
    const res = await fetch(`${BASE_URL}/tv/${id}/season/${seasonNum}?api_key=${API_KEY}&language=en-US`);
    return await res.json();
}

// --- RENDERERS ---

function renderHero(details, videos, images) {
    // --- SEO UPDATE ---
    updateSEOMetaTags(
        `${details.name} - FlixMax`,
        details.overview,
        details.backdrop_path ? `${IMG_ORIGINAL_URL}${details.backdrop_path}` : null
    );

    // 1. Background Image
    const bgImage = document.getElementById('hero-bg-image');
    if (details.backdrop_path) {
        bgImage.src = `${IMG_ORIGINAL_URL}${details.backdrop_path}`;
    }

    // 2. Logo or Title
    const logoContainer = document.getElementById('series-logo-container');
    const logo = images.logos.find(l => l.iso_639_1 === 'en') || images.logos[0];

    if (logo) {
        logoContainer.innerHTML = `<img src="${IMG_BASE_URL}${logo.file_path}" alt="${details.name}" class="series-logo">`;
    } else {
        logoContainer.innerHTML = `<h1 class="series-title-text">${details.name}</h1>`;
    }

    // 3. Meta Info
    const year = (details.first_air_date || '').split('-')[0];
    const seasons = details.number_of_seasons + (details.number_of_seasons === 1 ? ' Season' : ' Seasons');
    const match = Math.floor(Math.random() * (99 - 85) + 85);

    // Genres pills
    const genrePills = details.genres.slice(0, 3).map(g => `<span class="meta-pill" style="border:none; color: white;">${g.name}</span>`).join('<span style="margin:0 5px;">•</span>');

    document.getElementById('series-meta').innerHTML = `
        <span class="match-score">${match}% Match</span>
        <span>${year}</span>
        <span class="meta-pill">TV-MA</span>
        <span>${seasons}</span>
        <span class="meta-pill">HD</span>
    `;

    // 4. Description
    document.getElementById('series-desc').innerText = details.overview;

    // 5. Buttons (Update placeholders in HTML logic if called dynamically, but we updated HTML statically)
    const actionBtns = document.querySelector('.action-buttons');
    if (actionBtns) {
        const playBtn = document.createElement('button');
        playBtn.className = 'btn-play-white';
        playBtn.innerHTML = "<i class='bx bx-play'></i> Play";
        playBtn.onclick = () => {
            // Default to Season 1 Episode 1 or find first available
            window.location.href = `watch.html?id=${SERIES_ID}&type=tv&season=1&episode=1`;
        };

        actionBtns.innerHTML = ''; // Clear and append
        actionBtns.appendChild(playBtn);
        // Extra buttons for screenshot match

        // Append Episodes and Similars Buttons
        // Screenshot shows them near "Play".
        // Let's add them.

        const episodesBtn = document.createElement('button');
        episodesBtn.className = 'btn-glass-rect';
        episodesBtn.textContent = 'Episodes';
        episodesBtn.style.marginLeft = '10px';
        episodesBtn.onclick = () => document.getElementById('episodes-section').scrollIntoView({ behavior: 'smooth' });

        const similarBtn = document.createElement('button');
        similarBtn.className = 'btn-glass-rect';
        similarBtn.textContent = 'Similar';
        similarBtn.style.marginLeft = '10px';
        similarBtn.onclick = () => document.getElementById('recommendations-section').scrollIntoView({ behavior: 'smooth' });

        actionBtns.appendChild(episodesBtn);
        actionBtns.appendChild(similarBtn);
    }


    // 6. Video Trailer
    // ONLY load if desktop (width > 768px)
    if (window.innerWidth > 768) {
        const trailer = videos.results.find(v => v.site === 'YouTube' && v.type === 'Trailer') || videos.results.find(v => v.site === 'YouTube');
        if (trailer) {
            loadYoutubePlayer(trailer.key);
        }
    }
}

function setupSeasonSelector(seasons) {
    seasonSelect.innerHTML = seasons.map(s =>
        `<option value="${s.season_number}">${s.name}</option>`
    ).join('');

    seasonSelect.addEventListener('change', (e) => {
        loadSeason(e.target.value);
    });
}

async function loadSeason(seasonNum) {
    if (!episodesList) return;
    episodesList.innerHTML = '<div style="padding:20px;">Loading episodes...</div>';

    try {
        const data = await getTvSeason(SERIES_ID, seasonNum);
        renderEpisodes(data.episodes, seasonNum);
    } catch (e) {
        episodesList.innerHTML = '<div style="padding:20px;">Error loading episodes.</div>';
        console.error(e);
    }
}

function renderEpisodes(episodes, seasonNum) {
    if (!episodes || episodes.length === 0) {
        episodesList.innerHTML = '<div style="padding:20px;">No episodes found.</div>';
        return;
    }

    episodesList.innerHTML = episodes.map(ep => {
        // Use placeholder.png if no still_path
        const thumbUrl = ep.still_path ? `${IMG_BASE_URL}${ep.still_path}` : 'placeholder.png';

        return `
        <div class="episode-item" onclick="window.location.href='watch.html?id=${SERIES_ID}&type=tv&season=${seasonNum}&episode=${ep.episode_number}'" style="cursor: pointer;">
            <div class="episode-number">${ep.episode_number}</div>
            <div class="episode-thumb-container">
                <img src="${thumbUrl}" class="episode-thumb" alt="${ep.name}">
                <div class="play-icon-overlay"><i class='bx bx-play'></i></div>
            </div>
            <div class="episode-info">
                <div class="episode-header">
                    <span class="episode-title">${ep.name}</span>
                    <span class="episode-duration">${ep.runtime ? ep.runtime + 'm' : ''}</span>
                </div>
                <p class="episode-desc">${ep.overview || 'No description available.'}</p>
            </div>
        </div >
            `;
    }).join('');
}

function renderActors(cast) {
    if (!actorsGrid) return;
    const topCast = cast.slice(0, 10); // Show top 10

    actorsGrid.innerHTML = topCast.map(actor => {
        const photoUrl = actor.profile_path ? `${IMG_BASE_URL}${actor.profile_path}` : 'placeholder_avatar.png'; // Need fallback

        return `
            <div class="actor-card">
                <img src="${photoUrl}" class="actor-photo" alt="${actor.name}" onerror="this.src='https://via.placeholder.com/60'">
                    <div class="actor-info">
                        <span class="actor-name">${actor.name}</span>
                        <span class="actor-role">${actor.character}</span>
                    </div>
            </div>
        `;
    }).join('');
}

function renderRecommendations(shows) {
    if (!recommendationsGrid) return;
    const topRecs = shows.slice(0, 12);

    recommendationsGrid.innerHTML = topRecs.map(show => {
        return `
            <div class="rec-card" onclick="window.location.href='serieinfo.html?id=${show.id}&type=tv'">
                <img src="${IMG_BASE_URL}${show.poster_path}" alt="${show.name}" loading="lazy">
            </div>
        `;
    }).join('');
}


// --- PLAYER LOGIC (Reused) ---
function loadYoutubePlayer(videoId) {
    if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {
            createPlayer(videoId);
        };
    } else {
        createPlayer(videoId);
    }
}

function createPlayer(videoId) {
    if (videoPlayer) {
        videoPlayer.loadVideoById(videoId);
        return;
    }

    videoPlayer = new YT.Player('hero-video-iframe', {
        videoId: videoId,
        playerVars: {
            'autoplay': 1,
            'controls': 0,
            'showinfo': 0,
            'rel': 0,
            'loop': 1,
            'playlist': videoId,
            'mute': 1,
            'modestbranding': 1,
            'iv_load_policy': 3
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerReady(event) {
    event.target.playVideo();
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        const videoContainer = document.getElementById('hero-video-container');
        const bgImage = document.getElementById('hero-bg-image');

        setTimeout(() => {
            videoContainer.classList.add('visible');
            bgImage.style.opacity = 0;
        }, 500);
    }
}

function setupInteraction() {
    document.getElementById('back-btn').addEventListener('click', () => {
        window.location.href = 'index.html'; // Or history.back()
    });

    const muteBtn = document.getElementById('mute-btn');
    const muteIcon = muteBtn.querySelector('i');

    muteBtn.addEventListener('click', () => {
        if (videoPlayer && typeof videoPlayer.isMuted === 'function') {
            if (videoPlayer.isMuted()) {
                videoPlayer.unMute();
                muteIcon.className = 'bx bx-volume-full';
            } else {
                videoPlayer.mute();
                muteIcon.className = 'bx bx-volume-mute';
            }
        }
    });
}

// --- SEO Helper ---
function updateSEOMetaTags(title, description, image) {
    if (title) {
        document.title = title;
        document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
        document.querySelector('meta[property="twitter:title"]')?.setAttribute('content', title);
    }
    if (description) {
        document.querySelector('meta[name="description"]')?.setAttribute('content', description);
        document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
        document.querySelector('meta[property="twitter:description"]')?.setAttribute('content', description);
    }
    if (image) {
        document.querySelector('meta[property="og:image"]')?.setAttribute('content', image);
        document.querySelector('meta[property="twitter:image"]')?.setAttribute('content', image);
    }
}
