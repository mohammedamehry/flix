document.addEventListener('DOMContentLoaded', () => {
    init();
    setupSearch();
    setupMobileMenu(); // Ensure mobile menu is also setup independently if not already
});

// Helper to truncate text
function truncate(str, n) {
    return str?.length > n ? str.substr(0, n - 1) + "..." : str;
}

async function init() {
    // 0. Safety Timeout to ensure loading screen doesn't get stuck
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
            console.warn("Loading too long, forcing dismissal");
            loadingScreen.classList.add('hidden');
            setTimeout(() => loadingScreen.remove(), 500);
        }
    }, 1500); // 1.5 seconds max load time

    // 1. Hero Slider (Top 10 Trending)
    const trending = await getTrending();
    if (trending.length > 0) {
        // Use top 10 for slider
        await renderHeroSlider(trending.slice(0, 10));
    }

    // 2. Sliders
    // 2. Sliders
    // renderSlider('trending-slider', trending); // Removed


    const topRated = await getTopRated();
    renderSlider('top-rated-slider', topRated);

    // const actionData = await getActionMovies();
    // renderSlider('action-slider', actionData);

    // const actionData = await getActionMovies();
    // renderSlider('action-slider', actionData);

    const top10Data = trending.slice(0, 10);
    renderTop10(top10Data);

    const tvData = await getTvSeries();
    renderSlider('series-slider', tvData);

    // 3. Scroll Handles logic
    setupScrollHandles();
    setupProviderTabs();
    setupTopRatedTabs();
    setupGenreTabs();

    // Initial load for Genres (Comedy - default)
    const comedyData = await getMoviesByGenre(35);
    renderSlider('genres-slider', comedyData);

    // 4. Navbar Scroll Effect
    window.addEventListener('scroll', () => {
        const nav = document.getElementById('navbar');
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    });

    // 6. Hide Loading Screen
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
        // Optional: Remove from DOM after transition
        setTimeout(() => {
            loadingScreen.remove();
        }, 500);
    }
}

function setupSearch() {
    const searchInput = document.getElementById('search-input');
    const searchTrigger = document.getElementById('search-trigger'); // Home page icon

    const navigateToSearch = (e) => {
        // Only redirect if NOT already on search.html
        if (!window.location.pathname.includes('search.html')) {
            e.preventDefault();

            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                loadingScreen.classList.remove('hidden');
                loadingScreen.style.opacity = '1';
                loadingScreen.style.visibility = 'visible';

                setTimeout(() => {
                    window.location.href = 'search.html';
                }, 500); // 500ms matches CSS transition
            } else {
                window.location.href = 'search.html';
            }
        }
    };

    // Bind to Home Page Trigger
    if (searchTrigger) {
        searchTrigger.addEventListener('click', navigateToSearch);
    }

    if (searchInput && !window.location.pathname.includes('search.html')) {
        searchInput.addEventListener('focus', navigateToSearch);
        searchInput.addEventListener('click', navigateToSearch);
    }

    if (window.location.pathname.includes('search.html')) {
        // Logic specific to search.html
        if (searchInput) {
            searchInput.focus();

            searchInput.addEventListener('keyup', async (e) => {
                if (e.key === 'Enter') {
                    const query = searchInput.value;
                    if (query) {
                        const results = await searchMovies(query);
                        console.log("Search results:", results);
                        // TODO: Render results
                    }
                }
            });
        }
    }
}

function setupMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenuModal = document.getElementById('mobile-menu-modal');
    const closeMenuBtn = document.getElementById('close-menu-btn');

    if (mobileMenuBtn && mobileMenuModal && closeMenuBtn) {
        // Remove existing listeners to avoid duplicates if called multiple times? 
        // Better to just ensure this is called once. 
        // Since we are moving it out of global scope execution to a function, we need to be careful.
        // The previous code had it in global scope (lines 373+).
        // Let's remove the global scope block and put it here.

        // Clone replacement to ensure clean events
        const newBtn = mobileMenuBtn.cloneNode(true);
        mobileMenuBtn.parentNode.replaceChild(newBtn, mobileMenuBtn);

        newBtn.addEventListener('click', () => {
            mobileMenuModal.classList.add('open');
            document.body.style.overflow = 'hidden';
        });

        const newClose = closeMenuBtn.cloneNode(true);
        closeMenuBtn.parentNode.replaceChild(newClose, closeMenuBtn);

        newClose.addEventListener('click', () => {
            mobileMenuModal.classList.remove('open');
            document.body.style.overflow = '';
        });

        // Close on click outside
        mobileMenuModal.onclick = (e) => {
            if (e.target === mobileMenuModal) {
                mobileMenuModal.classList.remove('open');
                document.body.style.overflow = '';
            }
        };
    }
}



// Hero Slider Logic
let currentSlide = 0;
let slideInterval;
let heroMovies = [];

async function renderHeroSlider(movies) {
    heroMovies = movies;
    const track = document.getElementById('hero-slider-track');
    if (!track) return;
    track.innerHTML = ''; // clear

    // Create slides but don't load all images immediately if possible, but for 10 it's fine.
    // We will build HTML strings first.

    // We need to fetch details for all of them to get logos/genres? 
    // Optimization: Fetch details ONLY for the active slide. 
    // BUT user wants autoplay. Let's fetch basic info primarily. 
    // For smoother experience, let's fetch details for all 10 in parallel.

    const promises = movies.map(async (movie, index) => {
        const details = await getMovieDetails(movie.id);
        const images = await getMovieImages(movie.id);
        const logoPath = images && images.length > 0 ? images[0].file_path : null;

        const genres = (details && details.genres) ? details.genres.slice(0, 2).map(g => `<span class="pill">${g.name}</span>`).join('') : '';
        const year = (movie.release_date || movie.first_air_date || '').split('-')[0];
        const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';

        return `
            <div class="hero-slide ${index === 0 ? 'active' : ''}" data-index="${index}" style="background-image: url('${IMG_ORIGINAL_URL}${movie.backdrop_path}')">
                <div class="hero-content">
                    ${logoPath ? `<img src="${IMG_BASE_URL}${logoPath}" alt="${movie.title}" class="hero-logo-img">` : `<h1 class="hero-title">${movie.title || movie.name}</h1>`}
                    
                    <div class="hero-meta">
                        <span class="pill rating-pill"><i class='bx bxs-star'></i> ${rating}/10</span>
                        <span class="pill">${year}</span>
                        ${genres}
                    </div>
                    
                    <p class="hero-desc">${truncate(movie.overview, 200)}</p>
                    
                    <div class="hero-buttons">
                        ${(movie.name || movie.first_air_date) ?
                `<a href="serieinfo.html?id=${movie.id}&type=tv" class="btn btn-white btn-large"><i class='bx bx-play'></i> Play</a>` :
                `<a href="movieinfo.html?id=${movie.id}" class="btn btn-white btn-large"><i class='bx bx-play'></i> Play</a>`
            }
                    </div>
                </div>
            </div>
        `;
    });

    const slidesHTML = await Promise.all(promises);
    track.innerHTML = slidesHTML.join('');

    // Setup controls
    document.getElementById('hero-next').addEventListener('click', () => {
        nextSlide();
        resetInterval();
    });
    document.getElementById('hero-prev').addEventListener('click', () => {
        prevSlide();
        resetInterval();
    });

    startInterval();
}

function showSlide(index) {
    const slides = document.querySelectorAll('.hero-slide');
    slides.forEach(s => s.classList.remove('active'));

    // Wrap around
    if (index >= slides.length) currentSlide = 0;
    else if (index < 0) currentSlide = slides.length - 1;
    else currentSlide = index;

    slides[currentSlide].classList.add('active');
}

function nextSlide() {
    showSlide(currentSlide + 1);
}

function prevSlide() {
    showSlide(currentSlide - 1);
}

function startInterval() {
    slideInterval = setInterval(nextSlide, 7000); // 7 seconds
}

function resetInterval() {
    clearInterval(slideInterval);
    startInterval();
}

// Replaced simple renderHero with this slider logic
// function renderHero(movie) { ... } // Removed

function renderSlider(elementId, movies) {
    const slider = document.getElementById(elementId);
    if (!slider) return;
    slider.innerHTML = movies.map(movie => {
        const isSeries = movie.name || movie.first_air_date;
        // Link to movieinfo.html for movies, serieinfo.html for tv
        const base = isSeries ? 'serieinfo.html' : 'movieinfo.html';
        const link = `${base}?id=${movie.id}`;

        return `
        <a href="${link}" class="movie-card-link" style="text-decoration:none;">
            <div class="movie-card">
                <img src="${IMG_BASE_URL}${movie.poster_path}" alt="${movie.title || movie.name}">
            </div>
        </a>
    `}).join('');
}

function renderTop10(movies) {
    const slider = document.getElementById('top-10-slider');
    if (!slider) return;
    // Top 10 has special styling with big numbers
    slider.innerHTML = movies.map((movie, index) => {
        const isSeries = movie.name || movie.first_air_date;
        const base = isSeries ? 'serieinfo.html' : 'movieinfo.html';
        const link = `${base}?id=${movie.id}`;

        return `
        <a href="${link}" class="movie-card-link" style="text-decoration:none;">
            <div class="movie-card top-10-card">
                <span class="rank-number">${index + 1}</span>
                <img src="${IMG_BASE_URL}${movie.poster_path}" alt="${movie.title || movie.name}">
            </div>
        </a>
    `}).join('');
}

function setupProviderTabs() {
    // Scope to the specific section to avoid selecting Top Rated tabs
    const tabs = document.querySelectorAll('#series-row .provider-tab');
    const seriesHeader = document.querySelector('#series-row .provider-title .red-text');

    if (!seriesHeader) return; // Guard clause

    tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            // 1. UI Updates
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const providerName = tab.innerText;
            seriesHeader.innerText = providerName;

            // 2. Fetch Data
            // We need to map Name -> ID. Since we defined constants in api.js but not exported modules (simple script tags), we can expose PROVIDERS or just redefine map here or make api.js attach to window?
            // api.js consts are global scope since simple script inclusion? distinctMovies case suggested yes. 
            // Actually `const` in global scope in browser = global var if not module. 
            // Let's assume global access or safely redefine.

            const providerMap = {
                'Netflix': 8,
                'Prime': 9,
                'Max': 1899,
                'Disney+': 337,
                'AppleTV': 350,
                'Paramount': 531
            };

            const id = providerMap[providerName];
            if (id) {
                // Clear current slider to show loading state or transition?
                // Just fetch and render.
                const data = await getSeriesByProvider(id);
                renderSlider('series-slider', data);
            }
        });
    });
}

function setupGenreTabs() {
    const tabs = document.querySelectorAll('#genre-tabs .provider-tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const genreId = tab.getAttribute('data-id');
            const data = await getMoviesByGenre(genreId);
            renderSlider('genres-slider', data);
        });
    });
}

function setupTopRatedTabs() {
    const tabs = document.querySelectorAll('#top-rated-tabs .provider-tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            // UI Update
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const type = tab.getAttribute('data-type');
            let data = [];

            if (type === 'movie') {
                data = await getTopRated();
            } else if (type === 'tv') {
                data = await getTopRatedTv();
            }

            renderSlider('top-rated-slider', data);
        });
    });
}

function setupGenreTabs() {
    const tabs = document.querySelectorAll('#genre-tabs .provider-tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const genreId = tab.getAttribute('data-id');
            const data = await getMoviesByGenre(genreId);
            renderSlider('genres-slider', data);
        });
    });
}

function setupScrollHandles() {
    document.querySelectorAll('.slider-container').forEach(container => {
        const slider = container.querySelector('.slider');
        const leftBtn = container.querySelector('.left-handle');
        const rightBtn = container.querySelector('.right-handle');

        leftBtn.addEventListener('click', () => {
            slider.scrollBy({ left: -window.innerWidth / 2, behavior: 'smooth' });
        });

        rightBtn.addEventListener('click', () => {
            slider.scrollBy({ left: window.innerWidth / 2, behavior: 'smooth' });
        });
    });
}

// Mobile Menu Logic
// Mobile logic moved to setupMobileMenu

