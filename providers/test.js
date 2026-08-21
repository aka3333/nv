var TMDB_API_KEY = '500330721680edb6d5f7f12ba7cd9023';
var VERSION = "8.0.19-DIZI-FIX";

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const typePath = (mediaType === 'movie') ? 'movie' : 'tv';
        const tmdbUrl = `https://api.themoviedb.org/3/${typePath}/${tmdbId}?api_key=${TMDB_API_KEY}&language=tr-TR&append_to_response=external_ids`;
        
        const tmdbRes = await fetch(tmdbUrl);
        const d = await tmdbRes.json();
        
        const imdbId = d.external_ids ? d.external_ids.imdb_id : null;
        const title = d.title || d.name || "İçerik";
        
        if (!imdbId || !imdbId.startsWith('tt')) return [];

        let targetUrl = "";
        let displayTitle = title;

        if (mediaType === 'movie') {
            // Film Formatı: https://vidmody.com/vs/tt123456
            targetUrl = `https://vidmody.com/vs/${imdbId}`;
            const releaseYear = (d.release_date || '').slice(0, 4);
            displayTitle += releaseYear ? ` (${releaseYear})` : "";
            
            // Film HEAD isteği ile kontrol
            try {
                const checkRes = await fetch(targetUrl, { method: 'HEAD' });
                if (checkRes.status === 200) {
                    return [{
                        url: targetUrl,
                        name: `Vidmody`,
                        title: displayTitle,
                        quality: "Auto",
                        headers: {
                            'Referer': 'https://vidmody.com/',
                            'User-Agent': 'Mozilla/5.0'
                        }
                    }];
                }
            } catch (linkErr) {
                return [];
            }
        } else {
            // DİZİ FORMATI: SADECE BUNU DEĞİŞTİRDİK
            if (!season || !episode) return [];
            
            let sStr = "s" + season;
            let eStr = "e" + (episode < 10 ? "0" + episode : episode);
            
            // YENİ DİZİ FORMATI: /mm/ klasörüne yönlendir
            targetUrl = `https://vidmody.com/mm/${imdbId}/${sStr}/${eStr}/main_1080/index-v1-a1.gif`;
            displayTitle += ` - ${sStr.toUpperCase()}${eStr.toUpperCase()}`;
            
            // Dizi HEAD isteği ile kontrol
            try {
                const checkRes = await fetch(targetUrl, { 
                    method: 'HEAD',
                    headers: {
                        'Referer': 'https://vidmody.com/',
                        'User-Agent': 'Mozilla/5.0'
                    }
                });
                
                if (checkRes.status === 200 || checkRes.status === 302) {
                    return [{
                        url: targetUrl,
                        name: `Vidmody`,
                        title: displayTitle,
                        quality: "1080p",
                        headers: {
                            'Referer': 'https://vidmody.com/',
                            'User-Agent': 'Mozilla/5.0'
                        }
                    }];
                }
            } catch (linkErr) {
                return [];
            }
        }

        return [];

    } catch (e) {
        console.error(`[V${VERSION}] HATA: ${e.message}`);
        return [];
    }
}

if (typeof module !== 'undefined') module.exports = { getStreams };
