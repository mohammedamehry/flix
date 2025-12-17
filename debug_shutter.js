const fetch = require('node-fetch');

async function testApiStreams() {
    // Test "Shutter Island" (2010), TMDB ID 11324
    const params = new URLSearchParams({
        tmdbId: '11324',
        imdbId: 'tt1130884', // Need IMDB ID for proper query
        title: 'Shutter Island',
        year: '2010',
        type: 'movie'
    });

    const url = `http://localhost:3000/api/streams?${params.toString()}`;
    console.log(`Testing: ${url}`);

    try {
        const res = await fetch(url);
        const text = await res.text();
        console.log(`Status: ${res.status}`);
        console.log(`Body: ${text.substring(0, 500)}`);
    } catch (e) {
        console.error('Fetch failed:', e.message);
    }
}

testApiStreams();
