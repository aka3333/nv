var TMDB_API_KEY = '500330721680edb6d5f7f12ba7cd9023';
var VERSION = "8.0.10-DIZIBAL-STYLE";

function getStreams(tmdbId, mediaType, season, episode, callback) {
    // Önce TMDB'den veri çek
    var typePath = mediaType === 'movie' ? 'movie' : 'tv';
    var tmdbUrl = 'https://api.themoviedb.org/3/' + typePath + '/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=tr-TR&append_to_response=external_ids';
    
    fetch(tmdbUrl)
        .then(function(response) {
            if (!response.ok) {
                callback(null, []);
                return;
            }
            return response.json();
        })
        .then(function(data) {
            if (!data) {
                callback(null, []);
                return;
            }
            
            var imdbId = data.external_ids && data.external_ids.imdb_id;
            
            if (!imdbId || imdbId.indexOf('tt') !== 0) {
                callback(null, []);
                return;
            }

            var title = data.title || data.name || "İçerik";
            var targetUrl = '';
            var displayTitle = title;

            if (mediaType === 'movie') {
                targetUrl = 'https://vidmody.com/vs/' + imdbId;
                var year = data.release_date ? data.release_date.slice(0, 4) : '';
                if (year) displayTitle += ' (' + year + ')';
            } else {
                if (!season || !episode) {
                    callback(null, []);
                    return;
                }
                var episodeStr = episode < 10 ? '0' + episode : '' + episode;
                targetUrl = 'https://vidmody.com/vs/' + imdbId + '/s' + season + '/e' + episodeStr;
                displayTitle += ' - S' + season + 'E' + episode;
            }

            // DOĞRUDAN SONUÇ DÖN - Kontrol etmeden!
            // DiziBal gibi direkt linki döndür
            callback(null, [{
                url: targetUrl,
                name: 'Vidmody',
                title: displayTitle,
                quality: 'Auto',
                headers: {
                    'Referer': 'https://vidmody.com/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }]);
        })
        .catch(function() {
            callback(null, []);
        });
}

if (typeof module !== 'undefined') {
    module.exports = { getStreams: getStreams };
}
