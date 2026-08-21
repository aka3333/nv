var TMDB_API_KEY = '500330721680edb6d5f7f12ba7cd9023';
var VERSION = "8.0.8-STREMIO-CALLBACK";

function getStreams(tmdbId, mediaType, season, episode, callback) {
    try {
        var typePath = mediaType === 'movie' ? 'movie' : 'tv';
        var tmdbUrl = 'https://api.themoviedb.org/3/' + typePath + '/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=tr-TR&append_to_response=external_ids';
        
        fetch(tmdbUrl)
            .then(function(tmdbRes) {
                if (!tmdbRes.ok) {
                    callback(null, []);
                    return;
                }
                return tmdbRes.json();
            })
            .then(function(d) {
                if (!d) {
                    callback(null, []);
                    return;
                }
                
                var imdbId = d.external_ids && d.external_ids.imdb_id;
                
                if (!imdbId || imdbId.indexOf('tt') !== 0) {
                    callback(null, []);
                    return;
                }

                var title = d.title || d.name || "İçerik";
                var targetUrl = '';
                var displayTitle = title;

                if (mediaType === 'movie') {
                    targetUrl = 'https://vidmody.com/vs/' + imdbId;
                    var year = d.release_date ? d.release_date.slice(0, 4) : '';
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

                fetch(targetUrl, { 
                    method: 'HEAD',
                    headers: {
                        'Referer': 'https://vidmody.com/',
                        'User-Agent': 'Mozilla/5.0'
                    }
                })
                .then(function(checkRes) {
                    if (checkRes.ok) {
                        callback(null, [{
                            url: targetUrl,
                            name: 'Vidmody',
                            title: displayTitle,
                            quality: 'Auto',
                            headers: {
                                'Referer': 'https://vidmody.com/',
                                'User-Agent': 'Mozilla/5.0'
                            }
                        }]);
                    } else {
                        callback(null, []);
                    }
                })
                .catch(function() {
                    callback(null, []);
                });
            })
            .catch(function() {
                callback(null, []);
            });
    } catch (e) {
        callback(null, []);
    }
}

if (typeof module !== 'undefined') module.exports = { getStreams: getStreams };
