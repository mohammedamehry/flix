// Movie Info Page Logic

document.addEventListener('DOMContentLoaded', initMovieInfo);

// Extract ID from URL
const urlParams = new URLSearchParams(window.location.search);
const MOVIE_ID = urlParams.get('id');

let videoPlayer; // YT Player instance

// DOM Elements
const actorsGrid = document.getElementById('actors-grid');
const recommendationsGrid = document.getElementById('recommendations-grid');

async function initMovieInfo() {
    if (!MOVIE_ID) {
        window.location.href = 'index.html'; // Fallback
        return;
    }

    try {
        const details = await getMovieDetails(MOVIE_ID);
        const videos = await getMovieVideos(MOVIE_ID);
        const images = await getMovieImages(MOVIE_ID);
        const credits = await getMovieCredits(MOVIE_ID);
        const recommendations = await getMovieRecommendations(MOVIE_ID);

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
            !arabicPattern.test(item.title || '') &&
            !arabicPattern.test(item.overview || '') &&
            !nsfwPattern.test(item.title || '') &&
            !nsfwPattern.test(item.overview || '')
        );

        renderRecommendations(validRecs);

    } catch (e) {
        console.error("Error loading movie info:", e);
    }
}

// --- FETCHERS ---
async function getMovieDetails(id) {
    const res = await fetch(`${BASE_URL}/movie/${id}?api_key=${API_KEY}&language=en-US`);
    return await res.json();
}

async function getMovieVideos(id) {
    const res = await fetch(`${BASE_URL}/movie/${id}/videos?api_key=${API_KEY}&language=en-US`);
    return await res.json();
}

async function getMovieImages(id) {
    const res = await fetch(`${BASE_URL}/movie/${id}/images?api_key=${API_KEY}&include_image_language=en,null`);
    return await res.json();
}

async function getMovieCredits(id) {
    const res = await fetch(`${BASE_URL}/movie/${id}/credits?api_key=${API_KEY}&language=en-US`);
    return await res.json();
}

async function getMovieRecommendations(id) {
    const res = await fetch(`${BASE_URL}/movie/${id}/recommendations?api_key=${API_KEY}&language=en-US&page=1`);
    return await res.json();
}

// --- RENDERERS ---

function renderHero(details, videos, images) {
    // --- SEO UPDATE ---
    updateSEOMetaTags(
        `${details.title} - FlixMax`,
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
    // TMDB raw images often have no language or en
    const logo = images.logos.find(l => l.iso_639_1 === 'en') || images.logos[0];

    if (logo) {
        logoContainer.innerHTML = `<img src="${IMG_BASE_URL}${logo.file_path}" alt="${details.title}" class="series-logo">`;
    } else {
        logoContainer.innerHTML = `<h1 class="series-title-text">${details.title}</h1>`;
    }

    // 3. Meta Info
    const year = (details.release_date || '').split('-')[0];
    const runtime = details.runtime ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : '';
    const match = Math.floor(Math.random() * (99 - 85) + 85);

    document.getElementById('series-meta').innerHTML = `
        <span class="match-score">${match}% Match</span>
        <span>${year}</span>
        <span class="meta-pill">PG-13</span> <!-- Static for now -->
        <span>${runtime}</span>
        <span class="meta-pill">HD</span>
    `;

    // 4. Description
    document.getElementById('series-desc').innerText = details.overview;

    // 5. Buttons
    const actionBtns = document.querySelector('.action-buttons');
    if (actionBtns) {
        // Only Play and Similar for movies, no Episodes
        actionBtns.innerHTML = `
            <a href="watch.html?id=${details.id}" class="btn-play-white" style="text-decoration:none; display:inline-flex; align-items:center; justify-content:center;">
                <i class='bx bx-play'></i> Play
            </a>
        `;

        const similarBtn = document.createElement('button');
        similarBtn.className = 'btn-glass-rect';
        similarBtn.textContent = 'Similar';
        similarBtn.style.marginLeft = '10px';
        similarBtn.onclick = () => document.getElementById('recommendations-section').scrollIntoView({ behavior: 'smooth' });

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

function renderActors(cast) {
    if (!actorsGrid) return;
    const topCast = cast.slice(0, 10);

    actorsGrid.innerHTML = topCast.map(actor => {
        const photoUrl = actor.profile_path ? `${IMG_BASE_URL}${actor.profile_path}` : 'placeholder_avatar.png';

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

function renderRecommendations(movies) {
    if (!recommendationsGrid) return;
    const topRecs = movies.slice(0, 12);

    recommendationsGrid.innerHTML = topRecs.map(movie => {
        return `
        <div class="rec-card" onclick="window.location.href='movieinfo.html?id=${movie.id}'">
            <img src="${IMG_BASE_URL}${movie.poster_path}" alt="${movie.title}" loading="lazy">
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
        window.location.href = 'index.html';
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
