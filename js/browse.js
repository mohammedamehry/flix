document.addEventListener('DOMContentLoaded', initBrowse);

const state = {
    type: window.location.pathname.includes('series') ? 'tv' : 'movie',
    currentSort: 'popularity.desc', // default
    currentGenre: null,
    page: 1,
    isLoading: false,
    hasMore: true
};

async function initBrowse() {
    // Determine type based on URL
    console.log("Initializing Browse for type:", state.type);

    // Load Genres to populate filter bar
    await loadGenres();

    // Setup Filter Listeners (Static ones)
    setupFilterListeners();

    // Initial Load
    loadContent(true);
}

async function loadGenres() {
    const filterBar = document.getElementById('filter-bar');
    if (!filterBar) return;

    try {
        // Fetch genre list
        const endpoint = state.type === 'movie'
            ? 'https://api.themoviedb.org/3/genre/movie/list'
            : 'https://api.themoviedb.org/3/genre/tv/list';

        const res = await fetch(`${endpoint}?api_key=${API_KEY}&language=en-US`);
        const data = await res.json();

        if (data.genres) {
            data.genres.forEach(genre => {
                const btn = document.createElement('button');
                btn.className = 'filter-btn';
                btn.innerText = genre.name;
                btn.dataset.genreId = genre.id;

                btn.addEventListener('click', () => {
                    handleFilterClick(btn, null, genre.id);
                });

                filterBar.appendChild(btn);
            });
        }
    } catch (e) {
        console.error("Error loading genres", e);
    }
}

function setupFilterListeners() {
    const btns = document.querySelectorAll('.filter-btn[data-sort]');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            const sort = btn.dataset.sort;
            // Handle specific sort logic mapping if needed
            // e.g. "Most recent" for TV might be different field? 
            // primary_release_date works for movies. For TV it is first_air_date.

            let finalSort = sort;
            if (sort.includes('primary_release_date') && state.type === 'tv') {
                finalSort = 'first_air_date.desc';
            }

            handleFilterClick(btn, finalSort, null);
        });
    });
}

function handleFilterClick(clickedBtn, sortKey, genreId) {
    // UI Update
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    clickedBtn.classList.add('active');

    // State Update
    state.currentSort = sortKey || 'popularity.desc'; // Default to pop if genre selected? 
    // Actually if genre selected, we usually sort by popularity within that genre by default
    state.currentGenre = genreId;
    state.page = 1;
    state.hasMore = true;

    loadContent(true);
}

async function loadContent(reset = false) {
    if (state.isLoading) return;
    state.isLoading = true;

    const grid = document.getElementById('media-grid');
    if (reset) {
        grid.innerHTML = '<div class="loading-spinner"></div>'; // Or stick with simple text
    }

    try {
        // Construct API URL
        // Using discover endpoint
        const endpoint = state.type === 'movie' ? 'discover/movie' : 'discover/tv';
        let url = `${BASE_URL}/${endpoint}?api_key=${API_KEY}&language=en-US&page=${state.page}&include_adult=false`;

        // Sort
        if (state.currentSort) {
            url += `&sort_by=${state.currentSort}`;
        }

        // Genre
        if (state.currentGenre) {
            url += `&with_genres=${state.currentGenre}`;
        }

        // Date filter for "Most Recent" to ensure released items?
        // If sorting by date desc, we might get future items.
        // Let's rely on basic sort for now unless user complains.

        const res = await fetch(url);
        const data = await res.json();
        const results = data.results || [];

        if (reset) grid.innerHTML = '';

        if (results.length === 0 && state.page === 1) {
            grid.innerHTML = '<p>No results found.</p>';
            state.hasMore = false;
        } else {
            renderBrowseGrid(results);
        }

    } catch (e) {
        console.error("Browse load error", e);
        if (reset) grid.innerHTML = '<p>Error loading content.</p>';
    } finally {
        state.isLoading = false;
    }
}

function renderBrowseGrid(items) {
    const grid = document.getElementById('media-grid');

    items.forEach(item => {
        // Filter out items without poster
        if (!item.poster_path) return;

        // Strict filtering (Adult/NSFW/Arabic) - Reuse simple checks from render logic
        if (item.adult) return;
        if (item.original_language === 'ar') return;
        // Basic regex check if needed, but Browse usually safer than Search? 
        // Let's include basic check.
        const arabicPattern = /[\u0600-\u06FF]/;
        if (arabicPattern.test(item.title || item.name)) return;

        const card = document.createElement('div');
        card.className = 'movie-card'; // Reuse style

        // Check if current type is TV or Movie (default)
        const isSeries = state.type === 'tv';
        const base = isSeries ? 'serieinfo.html' : 'movieinfo.html';
        const link = `${base}?id=${item.id}`;

        card.innerHTML = `
            <a href="${link}" style="display:block; width:100%; height:100%;">
                <img src="${IMG_BASE_URL}${item.poster_path}" alt="${item.title || item.name}" loading="lazy" style="width:100%; height:auto;">
            </a>
        `;
        // Navigate to details (not implemented yet, but standard behavior)
        // card.onclick = ...

        grid.appendChild(card);
    });
}

// Infinite Scroll
window.addEventListener('scroll', () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        if (state.hasMore && !state.isLoading) {
            state.page++;
            loadContent(false);
        }
    }
});
