const API_KEY = '84259f99204eeb7d45c7e3d8e36c6123';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const IMG_ORIGINAL_URL = 'https://image.tmdb.org/t/p/original';

const endpoints = {
    trending: `${BASE_URL}/trending/all/day?api_key=${API_KEY}`,
    topRated: `${BASE_URL}/movie/top_rated?api_key=${API_KEY}&language=en-US&page=1`,
    actionMovies: `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=28`,
    comedyMovies: `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=35`,
    horrorMovies: `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=27`,
    romanceMovies: `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=10749`,
    documentaries: `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=99`,
    search: `${BASE_URL}/search/movie?api_key=${API_KEY}&query=`,
    searchTv: `${BASE_URL}/search/tv?api_key=${API_KEY}&query=`,
    searchMulti: `${BASE_URL}/search/multi?api_key=${API_KEY}&query=`,
    tvPopular: `${BASE_URL}/tv/popular?api_key=${API_KEY}&language=en-US&page=1`,
    tvTopRated: `${BASE_URL}/tv/top_rated?api_key=${API_KEY}&language=en-US&page=1`,
};

// ... existing code ...

async function fetchMovies(url) {
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.error("Failed to fetch:", url, error);
        return [];
    }
}

// Unified Search Function
async function searchContent(query, type = 'multi', page = 1) {
    let endpoint = endpoints.searchMulti; // default
    if (type === 'movie') endpoint = endpoints.search;
    if (type === 'tv') endpoint = endpoints.searchTv;
    if (type === 'anime') endpoint = endpoints.searchTv; // Proxy anime to TV

    const url = `${endpoint}${encodeURIComponent(query)}&page=${page}&include_adult=false`;
    return await fetchMovies(url);
}

// Deprecated old simple search
async function searchMovies(query) {
    return await searchContent(query, 'movie', 1);
}

async function getMovieImages(id) {
    try {
        const response = await fetch(`${BASE_URL}/movie/${id}/images?api_key=${API_KEY}&include_image_language=en,null`);
        const data = await response.json();
        return data.logos;
    } catch (error) {
        return [];
    }
}

async function getMovieDetails(id) {
    try {
        const response = await fetch(`${BASE_URL}/movie/${id}?api_key=${API_KEY}&language=en-US`);
        return await response.json();
    } catch (error) {
        return null;
    }
}

async function getTvDetails(id) {
    try {
        const response = await fetch(`${BASE_URL}/tv/${id}?api_key=${API_KEY}&language=en-US`);
        return await response.json();
    } catch (error) {
        return null;
    }
}

async function getTrending() {
    return await fetchMovies(endpoints.trending);
}

async function getTvSeries() {
    // Default to Netflix popular if we want to match the UI default state "Series on Netflix"
    return await getSeriesByProvider(8);
}

// Provider IDs (US Region)
const PROVIDERS = {
    'Netflix': 8,
    'Prime': 9,
    'Max': 1899,
    'Disney+': 337,
    'AppleTV': 350,
    'Paramount': 531
};

async function getSeriesByProvider(providerId) {
    // discover/tv with watch_providers
    const url = `${BASE_URL}/discover/tv?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&with_watch_providers=${providerId}&watch_region=US`;
    return await fetchMovies(url);
}

async function getTopRated() {
    return await fetchMovies(endpoints.topRated);
}

async function getTopRatedTv() {
    return await fetchMovies(endpoints.tvTopRated);
}

async function getActionMovies() {
    return await fetchMovies(endpoints.actionMovies);
}

async function getMoviesByGenre(genreId) {
    const url = `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${genreId}`;
    return await fetchMovies(url);
}
