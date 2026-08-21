var TMDB_API_KEY = '500330721680edb6d5f7f12ba7cd9023';
var VERSION = "8.0.1-UNIFIED-VERIFIED";

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const typePath = mediaType === 'movie' ? 'movie' : 'tv';
        const tmdbUrl = `https://api.themoviedb.org/3/${typePath}/${tmdbId}?api_key=${TMDB_API_KEY}&language=tr-TR&append_to_response=external_ids`;
        
        const tmdbRes = await fetch(tmdbUrl);
        if (!tmdbRes.ok) return [];
        
        const d = await tmdbRes.json();
        const imdbId = d.external_ids?.imdb_id;
        
        if (!imdbId || !imdbId.startsWith('tt')) return [];

        const title = d.title || d.name || "İçerik";
        let targetUrl, displayTitle = title;

        if (mediaType === 'movie') {
            targetUrl = `https://vidmody.com/vs/${imdbId}`;
            const year = d.release_date?.slice(0, 4);
            if (year) displayTitle += ` (${year})`;
        } else {
            if (!season || !episode) return [];
            targetUrl = `https://vidmody.com/vs/${imdbId}/s${season}/e${String(episode).padStart(2, '0')}`;
            displayTitle += ` - S${season}E${String(episode).padStart(2, '0')}`;
        }

        const checkRes = await fetch(targetUrl, { 
            method: 'HEAD',
            headers: {
                'Referer': 'https://vidmody.com/',
                'User-Agent': 'Mozilla/5.0'
            }
        });

        if (checkRes.ok) {
            return [{
                url: targetUrl,
                name: 'Vidmody',
                title: displayTitle,
                quality: 'Auto',
                headers: {
                    'Referer': 'https://vidmody.com/',
                    'User-Agent': 'Mozilla/5.0'
                }
            }];
        }

        return [];

    } catch (e) {
        return [];
    }
}

if (typeof module !== 'undefined') module.exports = { getStreams };
