var TMDB_API_KEY = '500330721680edb6d5f7f12ba7cd9023';
var VERSION = "8.0.2-FIX-DIZI-GET";

async function getStreams(tmdbId, mediaType, season, episode) {
    console.log(`[V${VERSION}] Başlatılıyor - TMDB ID: ${tmdbId}, Tip: ${mediaType}`);
    
    try {
        const typePath = mediaType === 'movie' ? 'movie' : 'tv';
        const tmdbUrl = `https://api.themoviedb.org/3/${typePath}/${tmdbId}?api_key=${TMDB_API_KEY}&language=tr-TR&append_to_response=external_ids`;
        
        console.log(`[V${VERSION}] TMDB isteği gönderiliyor: ${tmdbUrl}`);
        
        const tmdbRes = await fetch(tmdbUrl);
        if (!tmdbRes.ok) {
            console.log(`[V${VERSION}] TMDB hatası: ${tmdbRes.status}`);
            return [];
        }
        
        const d = await tmdbRes.json();
        const imdbId = d.external_ids?.imdb_id;
        
        console.log(`[V${VERSION}] TMDB'den alınan IMDB ID: ${imdbId}`);
        
        if (!imdbId || !imdbId.startsWith('tt')) {
            console.log(`[V${VERSION}] Geçersiz IMDB ID`);
            return [];
        }

        const title = d.title || d.name || "İçerik";
        let targetUrl, displayTitle = title;

        if (mediaType === 'movie') {
            targetUrl = `https://vidmody.com/vs/${imdbId}`;
            const year = d.release_date?.slice(0, 4);
            if (year) displayTitle += ` (${year})`;
            
            console.log(`[V${VERSION}] Film URL kontrol ediliyor: ${targetUrl}`);
            
            const checkRes = await fetch(targetUrl, { 
                method: 'HEAD',
                headers: {
                    'Referer': 'https://vidmody.com/',
                    'User-Agent': 'Mozilla/5.0'
                }
            });

            console.log(`[V${VERSION}] Film HEAD yanıt durumu: ${checkRes.status}`);
            
            if (checkRes.ok) {
                console.log(`[V${VERSION}] Film bulundu!`);
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
        } else {
            if (!season || !episode) {
                console.log(`[V${VERSION}] Dizi için sezon/bölüm eksik`);
                return [];
            }
            
            targetUrl = `https://vidmody.com/vs/${imdbId}/s${season}/e${String(episode).padStart(2, '0')}`;
            displayTitle += ` - S${season}E${String(episode).padStart(2, '0')}`;
            
            console.log(`[V${VERSION}] Dizi URL kontrol ediliyor: ${targetUrl}`);
            
            try {
                const checkRes = await fetch(targetUrl, { 
                    method: 'GET',
                    headers: {
                        'Referer': 'https://vidmody.com/',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                console.log(`[V${VERSION}] Dizi GET yanıt durumu: ${checkRes.status}`);
                
                if (checkRes.ok) {
                    const text = await checkRes.text();
                    const isValid = !text.includes('404') && !text.includes('Not Found');
                    console.log(`[V${VERSION}] Dizi sayfa geçerli mi: ${isValid}`);
                    
                    if (isValid) {
                        console.log(`[V${VERSION}] Dizi bulundu!`);
                        return [{
                            url: targetUrl,
                            name: 'Vidmody',
                            title: displayTitle,
                            quality: 'Auto',
                            headers: {
                                'Referer': 'https://vidmody.com/',
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            }
                        }];
                    }
                }
                console.log(`[V${VERSION}] Dizi bulunamadı`);
                return [];
            } catch (e) {
                console.error(`[V${VERSION}] Dizi GET isteği hatası: ${e.message}`);
                return [];
            }
        }

        console.log(`[V${VERSION}] Hiçbir yayın bulunamadı`);
        return [];

    } catch (e) {
        console.error(`[V${VERSION}] KRİTİK HATA: ${e.message}`);
        return [];
    }
}

if (typeof module !== 'undefined') module.exports = { getStreams };
