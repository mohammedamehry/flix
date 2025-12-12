const urlParams = new URLSearchParams(window.location.search);
const MOVIE_ID = urlParams.get('id');

// Detect iOS devices
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

console.log('Device detection:', { isIOS, isSafari, userAgent: navigator.userAgent });

// --- Mobile Debugger (Enabled by default for testing) ---
if (true) { // TODO: Revert to check urlParams.get('debug') === 'true' after fixing
    const debugOverlay = document.createElement('div');
    debugOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:50%;background:rgba(0,0,0,0.8);color:#0f0;font-family:monospace;font-size:10px;overflow-y:scroll;z-index:2147483647;pointer-events:none;padding:10px;white-space:pre-wrap;';
    document.body.appendChild(debugOverlay);

    const oldLog = console.log;
    const oldError = console.error;
    const oldWarn = console.warn;

    function logToScreen(type, args) {
        const line = document.createElement('div');
        line.textContent = `[${type}] ` + Array.from(args).map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ');
        if (type === 'ERROR') line.style.color = '#ff5555';
        if (type === 'WARN') line.style.color = '#ffff55';
        debugOverlay.appendChild(line);
        debugOverlay.scrollTop = debugOverlay.scrollHeight;
    }

    console.log = function (...args) { oldLog.apply(console, args); logToScreen('LOG', args); };
    console.error = function (...args) { oldError.apply(console, args); logToScreen('ERROR', args); };
    console.warn = function (...args) { oldWarn.apply(console, args); logToScreen('WARN', args); };

    // Capture Global Errors
    window.onerror = function (msg, url, line) {
        console.error(`Global Error: ${msg} (${url}:${line})`);
    };
}

// --- Loading Screen Logic ---
function getLoadingScreen() {
    return document.getElementById('loading-screen');
}

function showLoading() {
    const screen = getLoadingScreen();
    if (screen) {
        screen.classList.remove('hidden');
        screen.style.display = 'flex';

        // Manual dismiss backup
        screen.onclick = () => {
            console.log("User manually dismissed loading screen");
            hideLoading();
        }
    }
}

function hideLoading() {
    const screen = getLoadingScreen();
    if (screen) {
        console.log("Hiding loading screen...");
        screen.classList.add('hidden');
        // Allow clicks to pass through immediately
        screen.style.pointerEvents = 'none';

        // Fully remove from display after transition
        setTimeout(() => {
            screen.style.display = 'none';
        }, 500);
    }
}

// --- Main Watch Function ---
// --- Main Watch Function ---
async function initWatch() {
    if (!MOVIE_ID) {
        alert("No movie selected");
        window.location.href = 'index.html';
        return;
    }

    // Back Button Logic
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => window.history.back());
    }

    try {
        showLoading();
        console.log("Starting initWatch...");

        // Safety Timeout
        setTimeout(() => {
            console.warn("Loading timeout 10s reached. forcing hide.");
            hideLoading();
        }, 10000);

        // 1. Fetch Metadata
        const typeParam = urlParams.get('type');
        let details;

        console.log(`Fetching details for ID: ${MOVIE_ID}, Type: ${typeParam}`);

        if (typeParam === 'tv') {
            details = await getTvDetails(MOVIE_ID);
        } else {
            details = await getMovieDetails(MOVIE_ID);
        }

        if (details) {
            console.log("Details fetched:", details.title || details.name);
            document.title = `Watching: ${details.title || details.name}`;

            // --- UI UPDATE: Fill Header Info ---
            const headerTitle = document.getElementById('header-title');
            const headerMeta = document.getElementById('header-episode-info');
            const backdropEl = document.getElementById('loading-backdrop');

            // 2. Construct API URL
            const year = (details.release_date || details.first_air_date || '').split('-')[0];
            const isTv = typeParam === 'tv' || !!details.name;
            const type = isTv ? 'tv' : 'movie';

            let apiUrl = `${CONFIG.BACKEND_URL}/api/streams?tmdbId=${details.id}&imdbId=${details.imdb_id || ''}&title=${encodeURIComponent(details.title || details.name)}&year=${year}&type=${type}`;

            let displayTitle = '';
            if (isTv) {
                const season = urlParams.get('season') || 1;
                const episode = urlParams.get('episode') || 1;
                apiUrl += `&season=${season}&episode=${episode}`;

                if (headerMeta) {
                    headerMeta.innerText = `Season ${season} • Episode ${episode}`;
                }
                displayTitle = `${details.name} S${season} E${episode}`;
                document.title = `Watching: ${details.name} S${season}E${episode}`;

                // --- SEO UPDATE ---
                updateSEOMetaTags(
                    `Watching: ${displayTitle}`,
                    `Watch ${details.name} - Season ${season} Episode ${episode} in HD on FlixMax`,
                    details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : null
                );
            } else {
                displayTitle = details.title || details.name;

                // --- SEO UPDATE ---
                updateSEOMetaTags(
                    `Watching: ${displayTitle}`,
                    `Watch ${displayTitle} in HD on FlixMax`,
                    details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : null
                );
            }

            // Update header title
            if (headerTitle) {
                headerTitle.innerText = displayTitle;
            }

            // Backdrop
            if (details.backdrop_path) {
                const backdropUrl = `https://image.tmdb.org/t/p/original${details.backdrop_path}`;
                if (backdropEl) {
                    backdropEl.style.backgroundImage = `url('${backdropUrl}')`;
                }
            }

            console.log("Fetching streams from:", apiUrl);

            // 3. Construct Master Playlist URL (Server-side)
            const masterUrl = `${CONFIG.BACKEND_URL}/api/master.m3u8?tmdbId=${details.id}&imdbId=${details.imdb_id || ''}&title=${encodeURIComponent(details.title || details.name)}&year=${year}&type=${type}${isTv ? `&season=${urlParams.get('season') || 1}&episode=${urlParams.get('episode') || 1}` : ''}`;

            console.log("Using Master URL:", masterUrl);

            // Fetch subtitles separately for the player config (optional, but good for UI)
            // Note: We can fire this asynchronously without blocking playback, or fetch api/streams just for tracks if needed.
            // For now, let's keep it simple and just load the video. 
            // If we need tracks, we might need to fetch api/streams PARALLEL to setting the source, 
            // but to minimize delay, let's just set the source.
            // *To keep existing subtitle functionality, we still need to fetch /api/streams to get tracks list.*

            let tracks = [];
            try {
                const res = await fetch(apiUrl);
                const data = await res.json();
                if (data.tracks) {
                    data.tracks.forEach((t) => {
                        let trackUrl = t.file;
                        if (trackUrl.startsWith('/')) trackUrl = CONFIG.BACKEND_URL + trackUrl;
                        tracks.push({
                            file: trackUrl,
                            kind: 'captions',
                            label: t.label || 'English'
                        });
                    });
                }
            } catch (e) { console.warn("Could not load subtitles", e); }


            // --- INIT OVENPLAYER ---
            console.log("Initializing OvenPlayer...");

            // Initialize OvenPlayer with single Master Source
            const player = OvenPlayer.create('player', {
                image: details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : null,
                autoStart: true,
                sources: [
                    {
                        label: 'Auto',
                        type: 'hls',
                        file: masterUrl
                    }
                ],
                tracks: tracks,
                playbackRates: [0.5, 1, 1.25, 1.5, 2],
                controls: true,
                mute: false,
                playsinline: true,
                aspectRatio: '16:9',
                hlsConfig: {
                    debug: false,
                    enableWorker: true,
                    lowLatencyMode: false,
                    backBufferLength: 90
                }
            });

            // Event Listeners
            player.on('ready', function () {
                console.log("OvenPlayer is ready");
                hideLoading();
            });

            player.on('error', function (error) {
                console.error("OvenPlayer Error:", error);
                hideLoading();

                // Provide specific error message for iOS
                if (isIOS || isSafari) {
                    showError("Video Error", "An error occurred during playback. If you're on iOS, try: 1) Enable 'Allow Cross-Website Tracking' in Settings > Safari > Privacy, 2) Check your internet connection, 3) Try a different network.");
                } else {
                    showError("Video Error", "An error occurred during playback. Please try refreshing the page.");
                }
            });

            // Expose player globally
            window.player = player;
        } else {
            // Could not fetch details
            console.warn("Could not fetch details for the selected title.");
            hideLoading();
            showError("Details Not Found", "We couldn't retrieve information for this title. It might have been removed or is unavailable.");
        }

    } catch (error) {
        console.error("Error initializing player:", error);
        hideLoading();
        showError("Something Went Wrong", "Failed to load video information. Please try again.");
    }
}

// Helper to show the error overlay
function showError(title, message) {
    const overlay = document.getElementById('error-overlay');
    console.error(`[UI ERROR] ${title}: ${message}`); // Log to debug console

    if (!overlay) {
        console.error("Error overlay element not found!");
        alert(`${title}: ${message}`); // Fallback to alert
        return;
    }
    const titleEl = overlay.querySelector('h2');
    const msgEl = overlay.querySelector('p');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;

    overlay.classList.remove('hidden');
}


document.addEventListener('DOMContentLoaded', () => {
    initWatch();
    setupShareModal();
});

// --- Share Modal Logic ---
function setupShareModal() {
    const shareBtn = document.getElementById('share-btn');
    const shareModal = document.getElementById('share-modal');
    const closeBtn = document.querySelector('.close-share');
    if (!shareBtn || !shareModal) return;

    // Open Modal
    shareBtn.addEventListener('click', () => {
        shareModal.classList.remove('hidden');
    });

    // Close Modal (X button)
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            shareModal.classList.add('hidden');
        });
    }

    // Close Modal (Click Outside)
    shareModal.addEventListener('click', (e) => {
        if (e.target === shareModal) {
            shareModal.classList.add('hidden');
        }
    });

    // Share Options
    const shareOptions = document.querySelectorAll('.share-option');
    shareOptions.forEach(option => {
        option.addEventListener('click', () => {
            const platform = option.dataset.platform;
            const url = window.location.href;
            const title = document.title;
            let shareUrl = '';

            switch (platform) {
                case 'facebook':
                    shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
                    break;
                case 'twitter':
                    shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
                    break;
                case 'whatsapp':
                    shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(title + ' ' + url)}`;
                    break;
                case 'telegram':
                    shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
                    break;
                case 'reddit':
                    shareUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
                    break;

                case 'copy':
                    copyToClipboard(url, option);
                    return; // Don't open window for copy
            }

            if (shareUrl) {
                window.open(shareUrl, '_blank', 'width=600,height=400');
            }
        });
    });
}

function copyToClipboard(text, element) {
    navigator.clipboard.writeText(text).then(() => {
        const originalText = element.querySelector('span').innerText;
        element.querySelector('span').innerText = 'Copied!';
        setTimeout(() => {
            element.querySelector('span').innerText = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
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
