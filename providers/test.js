var TMDB_API_KEY = '500330721680edb6d5f7f12ba7cd9023';
var VERSION = "8.0.30-FINAL-FIX";

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log(`[V${VERSION}] İstek Alındı -> Tür: ${mediaType}, TMDB: ${tmdbId}, Sezon: ${season}, Bölüm: ${episode}`);

        // Dizi tiplerini güvenli şekilde yakalayalım ('tv' veya 'series')
        const isMovie = (mediaType === 'movie');
        const typePath = isMovie ? 'movie' : 'tv';
        
        const tmdbUrl = `https://api.themoviedb.org/3/${typePath}/${tmdbId}?api_key=${TMDB_API_KEY}&language=tr-TR&append_to_response=external_ids`;
        
        const tmdbRes = await fetch(tmdbUrl);
        const d = await tmdbRes.json();
        
        const imdbId = d.external_ids ? d.external_ids.imdb_id : null;
        const title = d.title || d.name || "İçerik";
        
        if (!imdbId || !imdbId.startsWith('tt')) {
            console.log(`[V${VERSION}] Geçerli IMDb ID bulunamadı.`);
            return [];
        }

        let targetUrl = "";
        let displayTitle = title;

        if (isMovie) {
            targetUrl = `https://vidmody.com/vs/${imdbId}`;
            const releaseYear = (d.release_date || '').slice(0, 4);
            displayTitle += releaseYear ? ` (${releaseYear})` : "";
            
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
        } else {
            // Dizi için season veya episode gelmezse varsayılan 1 yapalım ki patlamasın
            let s = season || 1;
            let e = episode || 1;
            
            let sStr = "s" + s;
            let eStr = "e" + (e < 10 ? "0" + e : e);
            
            targetUrl = `https://vidmody.com/vs/${imdbId}/${sStr}/${eStr}`;
            displayTitle += ` - ${sStr.toUpperCase()}${eStr.toUpperCase()}`;
            
            console.log(`[V${VERSION}] Dizi Linki Üretildi: ${targetUrl}`);

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

    } catch (e) {
        console.error(`[V${VERSION}] KRİTİK HATA: ${e.message}`);
        return [];
    }
}

if (typeof module !== 'undefined') module.exports = { getStreams };
