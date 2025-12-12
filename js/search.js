// Search Page Logic
document.addEventListener('DOMContentLoaded', initSearch);

// State Management
let state = {
    query: '',
    filter: 'all', // all, movie, tv, anime
    page: 1,
    isLoading: false,
    hasMore: true
};

async function initSearch() {
    // 0. Safety Timeout
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
            console.warn("Loading too long (search), forcing dismissal");
            loadingScreen.classList.add('hidden');
            setTimeout(() => loadingScreen.remove(), 500);
        }
    }, 2000);

    // 1. Initial Data (Trending)
    await loadTrending();

    // 2. Hide Loading Screen
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
        setTimeout(() => loadingScreen.remove(), 500);
    }

    // 3. Setup UI Interactions
    setupSearchInput();
    setupCustomDropdown();
    setupInfiniteScroll();
    setupMobileMenu();
}

async function loadTrending() {
    try {
        const trends = await getTrending();
        if (trends && trends.length > 0) {
            // Filter: No Adult, No Arabic, Must have Poster, No NSFW keywords
            const arabicPattern = /[\u0600-\u06FF]/;
            const nsfwPattern = /\b(erotic|erotica|softcore|porn|xxx|hentai|uncensored|nudity|18\+|adult|rape|sexual)\b/i;

            const validTrends = trends.filter(item =>
                !item.adult &&
                item.original_language !== 'ar' &&
                item.poster_path &&
                !arabicPattern.test(item.title || '') &&
                !arabicPattern.test(item.overview || '') &&
                !nsfwPattern.test(item.title || '') &&
                !nsfwPattern.test(item.overview || '')
            );
            renderGrid(validTrends.slice(0, 18), 'Trending Today', true); // true = reset grid
        }
    } catch (e) { console.error("Error loading trending:", e); }
}

function setupSearchInput() {
    const mainInput = document.getElementById('main-search-input');
    if (!mainInput) return;

    let debounceTimer;

    mainInput.focus();
    mainInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const val = mainInput.value.trim();

        debounceTimer = setTimeout(() => {
            if (val) {
                // New Search
                state.query = val;
                state.page = 1;
                state.hasMore = true;
                performSearch(true); // reset
            } else {
                // Clear
                state.query = '';
                loadTrending();
            }
        }, 500); // 500ms delay
    });
}

function setupCustomDropdown() {
    const dropdown = document.getElementById('filter-dropdown');
    const btn = dropdown.querySelector('.dropdown-btn');
    const items = dropdown.querySelectorAll('.dropdown-item');
    const selectedSpan = document.getElementById('selected-filter');

    if (!dropdown || !btn) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) dropdown.classList.remove('open');
    });

    items.forEach(item => {
        item.addEventListener('click', () => {
            // UI Update
            items.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            selectedSpan.innerText = item.innerText;
            dropdown.classList.remove('open');

            // Logic Update
            const newFilter = item.getAttribute('data-value');
            if (state.filter !== newFilter) {
                state.filter = newFilter;
                // If we have a query, re-search. 
                if (state.query) {
                    state.page = 1;
                    state.hasMore = true;
                    performSearch(true);
                } else {
                    // Handle "Trending" filter?
                    // Currently trending is mixed. 
                    // We could filter trending by type if we want to be fancy, but simple replacement is fine.
                }
            }
        });
    });
}

function setupInfiniteScroll() {
    window.addEventListener('scroll', () => {
        if (state.isLoading || !state.hasMore || !state.query) return;

        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        if (scrollTop + clientHeight >= scrollHeight - 600) { // Threshold
            state.page++;
            performSearch(false); // append
        }
    });
}

async function performSearch(reset = false) {
    if (state.isLoading) return;
    state.isLoading = true;

    const resultsContainer = document.getElementById('search-results-grid');
    if (reset) {
        resultsContainer.innerHTML = '<p class="empty-state">Searching...</p>';
    }

    try {
        let results = await searchContent(state.query, state.filter, state.page);

        // Filter strict: No Adult, No Arabic (Lang or Text), Must have Poster, No NSFW keywords
        const arabicPattern = /[\u0600-\u06FF]/;
        const nsfwPattern = /\b(erotic|erotica|softcore|porn|xxx|hentai|uncensored|nudity|18\+|adult|rape|sexual)\b/i;

        results = results.filter(item =>
            !item.adult &&
            item.original_language !== 'ar' &&
            item.poster_path &&
            !arabicPattern.test(item.title || '') &&
            !arabicPattern.test(item.overview || '') &&
            !nsfwPattern.test(item.title || '') &&
            !nsfwPattern.test(item.overview || '')
        );

        // Sort by Weighted Score (Popularity * Rating) to surface "All-time Hits" like GoT
        results.sort((a, b) => {
            const scoreA = (a.popularity || 0) * (a.vote_average || 0);
            const scoreB = (b.popularity || 0) * (b.vote_average || 0);
            return scoreB - scoreA;
        });

        // Custom Filtering for Anime
        if (state.filter === 'anime') {
            results = results.filter(item => {
                return item.genre_ids && item.genre_ids.includes(16) && item.original_language === 'ja';
            });
        }

        if (results.length === 0) {
            // If page 1 empty -> no results. If page >1 empty -> no more.
            if (state.page === 1) {
                if (reset) resultsContainer.innerHTML = '<p class="empty-state">No results found.</p>';
            }
            state.hasMore = false;
        } else {
            renderGrid(results, `Results for "${state.query}"`, reset);
        }

    } catch (error) {
        console.error("Search error", error);
        if (reset) resultsContainer.innerHTML = '<p class="empty-state">Error occurred.</p>';
    } finally {
        state.isLoading = false;
    }
}

function renderGrid(movies, titleText, reset = false) {
    const resultsContainer = document.getElementById('search-results-grid');
    const sectionTitle = document.querySelector('.search-results-section h2');

    if (sectionTitle && titleText) sectionTitle.innerText = titleText;

    // If reset, clear innerHTML first.
    if (reset) {
        resultsContainer.innerHTML = '';
    }

    const html = movies.map(movie => {
        const poster = movie.poster_path ? `${IMG_BASE_URL}${movie.poster_path}` : 'placeholder.png';
        const title = movie.title || movie.name;

        // Determine type
        const isSeries = movie.media_type === 'tv' || movie.first_air_date || movie.name;
        const targetPage = isSeries ? 'serieinfo.html' : 'movieinfo.html';
        const link = `${targetPage}?id=${movie.id}`;

        return `
            <a href="${link}" class="movie-card-link" style="display:block; text-decoration:none; color:inherit;">
                <div class="movie-card" title="${title}">
                    <img src="${poster}" alt="${title}">
                </div>
            </a>
        `;
    }).join('');

    resultsContainer.insertAdjacentHTML('beforeend', html);
}

function setupMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenuModal = document.getElementById('mobile-menu-modal');
    if (mobileMenuBtn && mobileMenuModal) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenuModal.classList.add('open');
            document.body.style.overflow = 'hidden';
        });
        const closeBtn = document.getElementById('close-menu-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                mobileMenuModal.classList.remove('open');
                document.body.style.overflow = '';
            });
        }
    }
}
