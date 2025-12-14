const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
// Enable CORS for all routes
app.use(cors());

// Trust proxy (required for correct protocol detection behind Nginx/Cloudflare)
app.set('trust proxy', true);

// Serve static files (CSS, JS, images)
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use(express.static(path.join(__dirname, 'public')));

// Handle OPTIONS preflight requests for CORS (important for iOS)
app.options('*', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).send();
});

// Proxy endpoint for HLS streams
app.get('/proxy', async (req, res) => {
    const { url, referer, origin } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    const targetUrl = decodeURIComponent(url);
    const customReferer = referer ? decodeURIComponent(referer) : 'https://api.videasy.net/';
    const customOrigin = origin ? decodeURIComponent(origin) : 'https://api.videasy.net';

    console.log(`[Proxy] Fetching: ${targetUrl.substring(0, 80)}...`);

    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Referer': customReferer,
            'Origin': customOrigin,
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
        };

        // Forward range header if present (for seeking)
        if (req.headers.range) {
            headers['Range'] = req.headers.range;
        }

        const response = await fetch(targetUrl, { headers });

        if (!response.ok) {
            console.error(`[Proxy] Error: ${response.status} ${response.statusText}`);
            return res.status(response.status).send(`Upstream error: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || '';
        const forceM3U8 = req.query.type === 'm3u8';
        const isM3U8 = forceM3U8 || contentType.includes('mpegurl') || targetUrl.includes('.m3u8');
        const isSegment = targetUrl.includes('/seg-') || /\.(ts|m4s|mp4|jpg|png|html|js|css|txt|webp)$/i.test(targetUrl);

        // Forward status code (Important for 206 Partial Content / Seeking)
        res.status(response.status);

        // Handle M3U8 manifest - rewrite URLs
        if (isM3U8) {
            const text = await response.text();
            console.log(`[Proxy] M3U8 manifest: ${text.length} bytes`);

            const baseUrl = new URL(targetUrl);
            const lines = text.split('\n');
            const rewrittenLines = lines.map(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    try {
                        // Resolve relative URLs
                        const absoluteUrl = new URL(trimmed, targetUrl).toString();
                        // Rewrite to go through our proxy
                        return `/proxy?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(customReferer)}&origin=${encodeURIComponent(customOrigin)}`;
                    } catch (e) {
                        return line;
                    }
                }
                return line;
            });

            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
            res.send(rewrittenLines.join('\n'));

            // Handle video segments - fix content-type
            // Handle video segments - fix content-type
        } else if (isSegment) {
            // Determine correct Content-Type
            let fixedContentType = 'video/mp2t'; // Default to TS
            if (targetUrl.includes('.m4s') || targetUrl.includes('.mp4')) {
                fixedContentType = 'video/iso.segment';
            } else if (targetUrl.includes('.aac') || targetUrl.includes('.mp3')) {
                fixedContentType = 'audio/aac';
            }

            console.log(`[Proxy] Segment (${fixedContentType}): ${targetUrl.substring(targetUrl.length - 20)}`);

            res.setHeader('Content-Type', fixedContentType);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');

            // Forward other important headers
            if (response.headers.get('content-range')) {
                res.setHeader('Content-Range', response.headers.get('content-range'));
            }
            if (response.headers.get('content-length')) {
                res.setHeader('Content-Length', response.headers.get('content-length'));
            }
            if (response.headers.get('accept-ranges')) {
                res.setHeader('Accept-Ranges', response.headers.get('accept-ranges'));
            } else {
                // iOS requires Accept-Ranges header
                res.setHeader('Accept-Ranges', 'bytes');
            }

            // Stream the response
            response.body.pipe(res);

            // Handle other content (subtitles, etc)
        } else {
            res.setHeader('Content-Type', contentType);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
            response.body.pipe(res);
        }

    } catch (error) {
        console.error(`[Proxy] Error:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get streams endpoint (calls local getSources)
app.get('/api/streams', async (req, res) => {
    const { tmdbId, imdbId, title, year, type, season, episode } = req.query;

    if (!tmdbId || !title) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        console.log(`[API] Fetching streams for: ${title}`);

        const data = await getSources({ tmdbId, imdbId, type, year, title, season, episode });

        if (data.error) {
            return res.status(500).json(data);
        }

        // Rewrite stream URLs to go through our proxy
        if (data.streams) {
            data.streams = data.streams.map(stream => ({
                ...stream,
                file: `/proxy?url=${encodeURIComponent(stream.file)}&referer=${encodeURIComponent(data.headers.referer || 'https://api.videasy.net/')}&origin=${encodeURIComponent(data.headers.origin || 'https://api.videasy.net')}&type=m3u8`
            }));
        }

        // Rewrite subtitle track URLs to go through our proxy
        if (data.tracks) {
            data.tracks = data.tracks.map(track => ({
                ...track,
                file: `/proxy?url=${encodeURIComponent(track.file)}&referer=${encodeURIComponent(data.headers.referer || 'https://api.videasy.net/')}&origin=${encodeURIComponent(data.headers.origin || 'https://api.videasy.net')}`
            }));
        }

        res.json(data);

    } catch (error) {
        console.error(`[API] Error:`, error.message);
        if (error.message === 'No streams found') {
            return res.status(404).json({ error: 'No streams found for this title' });
        }
        res.status(500).json({ error: error.message });
    }
});

// New Endpoint: Serve Master Playlist directly (Required for iOS)
app.get('/api/master.m3u8', async (req, res) => {
    const { tmdbId, imdbId, title, year, type, season, episode } = req.query;

    if (!tmdbId || !title) {
        return res.status(400).send('#EXTM3U\n#EXT-X-ERROR: Missing parameters');
    }

    try {
        console.log(`[Master] Generating playlist for: ${title}`);
        const data = await getSources({ tmdbId, imdbId, type, year, title, season, episode });

        if (data.error || !data.streams) {
            return res.status(500).send('#EXTM3U\n#EXT-X-ERROR: No streams found');
        }

        // Generate Master Playlist content
        let masterPlaylist = "#EXTM3U\n#EXT-X-VERSION:3\n";

        // Sort by quality
        data.streams.sort((a, b) => b.quality - a.quality);

        data.streams.forEach(stream => {
            // Construct Proxy URL
            // Force HTTPS unless we are on localhost
            const host = req.get('host');
            const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
            const proxyUrl = `${protocol}://${host}/proxy?url=${encodeURIComponent(stream.file)}&referer=${encodeURIComponent(data.headers.referer || 'https://api.videasy.net/')}&origin=${encodeURIComponent(data.headers.origin || 'https://api.videasy.net')}&type=m3u8`;

            // Bandwidth estimation
            const bandwidthMap = {
                360: 800000, 480: 1400000, 720: 2800000, 1080: 5000000, 4096: 10000000
            };
            const bandwidth = bandwidthMap[stream.quality] || 3000000;

            masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${Math.round(16 / 9 * stream.quality)}x${stream.quality},NAME="${stream.quality}p"\n`;
            masterPlaylist += `${proxyUrl}\n`;
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Content-Disposition', 'inline; filename="master.m3u8"');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(masterPlaylist);

    } catch (error) {
        console.error(`[Master] Error:`, error.message);
        res.status(500).send('#EXTM3U\n#EXT-X-ERROR: Server Error');
    }
});

async function getSources(movieInfo) {
    const PROVIDER = 'AVideasy';
    const DOMAIN = "https://api.videasy.net";
    const headers = {
        'user-agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        'referer': `${DOMAIN}/`,
        "origin": `${DOMAIN}`
    };

    const sources = ["myflixerzupcloud"];

    // Logic adapted from decryptvds.js
    for (const source of sources) {
        try {
            let url = `https://api.videasy.net/myflixerzupcloud/sources-with-title?mediaType=${movieInfo.type}&year=${movieInfo.year}&tmdbId=${movieInfo.tmdbId}&imdbId=${movieInfo.imdbId}&title=${encodeURIComponent(movieInfo.title)}`;

            if (movieInfo.type === "tv") {
                url += `&episodeId=${movieInfo.episode}&seasonId=${movieInfo.season}`;
            }

            console.log(`[getSources] Requesting: ${url}`);
            const response = await fetch(url, { headers });
            const textDetail = await response.text();
            console.log(`[getSources] Response length: ${textDetail.length}`);
            console.log(`[getSources] Raw upstream response: ${textDetail}`);

            if (!textDetail) {
                console.log(`[getSources] Empty response from ${source}`);
                continue;
            }

            // Decrypt Logic
            const urlDecrypt = "https://enc-dec.app/api/dec-videasy";
            const body = {
                text: textDetail,
                id: movieInfo.tmdbId
            };

            console.log(`[getSources] Decrypting...`);
            const decResponse = await fetch(urlDecrypt, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            const decryptData = await decResponse.json();
            console.log(`[getSources] Decrypt result keys: ${Object.keys(decryptData || {})}`);
            console.log(`[getSources] Decrypt response: ${JSON.stringify(decryptData)}`);

            if (!decryptData || !decryptData.result || !decryptData.result.sources) {
                console.log(`[getSources] Invalid decrypt data or no sources`);
                continue;
            }

            // Process Sources
            let directQuality = [];
            const tracks = [];

            if (decryptData.result.sources) {
                for (const item of decryptData.result.sources) {
                    let quality = item.quality;
                    const match = quality && quality.match(/([0-9]+)/i);
                    quality = match ? Number(match[1]) : 1080;

                    directQuality.push({
                        file: item.url,
                        quality: quality,
                        type: 'hls' // Assuming HLS based on context
                    });
                }
            }

            if (decryptData.result.subtitles) {
                for (const sub of decryptData.result.subtitles) {
                    tracks.push({
                        file: sub.url,
                        kind: 'captions',
                        label: sub.language
                    });
                }
            }

            if (directQuality.length === 0) continue;

            // Sort by quality desc
            directQuality.sort((a, b) => b.quality - a.quality);

            return {
                source: PROVIDER,
                streams: directQuality,
                tracks: tracks,
                headers: headers // Return the headers needed for playback
            };

        } catch (e) {
            console.error(`Error processing source ${source}:`, e);
            continue;
        }
    }

    throw new Error("No streams found");
}

// Serve watch page
app.get('/watch', (req, res) => {
    res.sendFile(path.join(__dirname, 'watch.html'));
});

// Serve home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Explicitly serve index.html and watch.html to match frontend links
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/watch.html', (req, res) => res.sendFile(path.join(__dirname, 'watch.html')));

// Serve other pages
app.get('/movies.html', (req, res) => res.sendFile(path.join(__dirname, 'movies.html')));
app.get('/series.html', (req, res) => res.sendFile(path.join(__dirname, 'series.html')));
app.get('/search.html', (req, res) => res.sendFile(path.join(__dirname, 'search.html')));
app.get('/movieinfo.html', (req, res) => res.sendFile(path.join(__dirname, 'movieinfo.html')));
app.get('/serieinfo.html', (req, res) => res.sendFile(path.join(__dirname, 'serieinfo.html')));
app.get('/404.html', (req, res) => res.sendFile(path.join(__dirname, '404.html')));

// Fallback for 404
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;