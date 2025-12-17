const fetch = require('node-fetch');

async function testApiStreams() {
    const params = new URLSearchParams({
        tmdbId: '27205',
        imdbId: 'tt1375666',
        title: 'Inception',
        year: '2010',
        type: 'movie'
    });

    const url = `http://localhost:3000/api/streams?${params.toString()}`;
    console.log(`Testing: ${url}`);

    try {
        const res = await fetch(url);
        const text = await res.text();
        console.log(`Status: ${res.status}`);

        if (res.status === 200) {
            const data = JSON.parse(text);
            if (data.streams && data.streams.length > 0) {
                const streamUrl = data.streams[0].file;
                console.log(`\nTesting Stream Proxy: http://localhost:3000${streamUrl}`);

                const res2 = await fetch(`http://localhost:3000${streamUrl}`);
                console.log(`Proxy Status: ${res2.status}`);
                const text2 = await res2.text();
                console.log(`Proxy Body: ${text2.substring(0, 200)}`);
            } else {
                console.log("No streams found to test.");
            }
        } else {
            console.log(`Body: ${text}`);
        }

    } catch (e) {
        console.error('Fetch failed:', e.message);
    }
}

testApiStreams();
