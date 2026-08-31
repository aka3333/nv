// v7 - Kesin ve Hatasız DiziBal Nuvio Eklentisi
var DIZIBAL_URL = 'https://dizibal.org';
var TMDB_API_KEY = '8c598c9af9b0badc281e95b1890834bc';
var PROVIDER_NAME = 'DiziBal';

var HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': DIZIBAL_URL + '/'
};

function fetchTmdbInfo(imdbId, mediaType) {
  var cleanId = String(imdbId).trim();
  var isTv = (mediaType === 'series' || mediaType === 'tv');
  var findUrl = 'https://api.themoviedb.org/3/find/' + cleanId + '?api_key=' + TMDB_API_KEY + '&external_source=imdb_id&language=tr-TR';
  
  return fetch(findUrl)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var item = isTv 
        ? ((data.tv_results && data.tv_results[0]) || (data.movie_results && data.movie_results[0]))
        : ((data.movie_results && data.movie_results[0]) || (data.tv_results && data.tv_results[0]));
      
      return {
        titleTr: (item && (item.title || item.name)) || '',
        titleEn: (item && (item.original_title || item.original_name)) || '',
        id: item ? String(item.id) : null,
        isTv: isTv
      };
    })
    .catch(function() {
      return {
        titleTr: '',
        titleEn: '',
        id: null,
        isTv: isTv
      };
    });
}

function performSearch(query, isTv) {
  var type = isTv ? "series" : "movies";
  var searchUrl = DIZIBAL_URL + '/api/' + type + '?search=' + encodeURIComponent(query) + '&page=1&limit=20&siteMode=full';
  
  return fetch(searchUrl, { headers: HEADERS })
    .then(function(r) { return r.json(); })
    .then(function(json) { return json.data || []; })
    .catch(function() { return []; });
}

function findDiziBalItem(tmdbInfo) {
  var queries = [tmdbInfo.titleEn, tmdbInfo.titleTr].filter(Boolean);
  
  function trySearch(index) {
    if (index >= queries.length) return Promise.resolve(null);
    var query = queries[index];
    
    return performSearch(query, tmdbInfo.isTv).then(function(resList) {
      var found = resList.find(function(r) {
        var rId = r.id ? String(r.id) : "";
        return tmdbInfo.id && rId === tmdbInfo.id;
      });
      
      return found || trySearch(index + 1);
    });
  }
  
  return trySearch(0);
}

function resolveEmbedStream(streamUrl, movieTitle) {
  var u;
  try {
    u = new URL(streamUrl);
  } catch (e) {
    return Promise.resolve(null);
  }

  return fetch(streamUrl, {
    headers: {
      'User-Agent': HEADERS['User-Agent'],
      'Referer': DIZIBAL_URL + '/'
    }
  })
  .then(function(r) { return r.text(); })
  .then(function(html) {
    var getStreamMatch = html.match(/fetch\(['"](\/dl\?op=get_stream[^'"]+)['"]/);
    if (!getStreamMatch) return null;

    var streamApiUrl = u.origin + getStreamMatch[1];
    return fetch(streamApiUrl, {
      headers: {
        'User-Agent': HEADERS['User-Agent'],
        'Referer': streamUrl,
        'Origin': u.origin,
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
    .then(function(res) { return res.json(); })
    .then(function(streamJson) {
      if (!streamJson.url) return null;

      var subList = [];
      var subMatch = html.match(/"subtitle"\s*:\s*"([^"]+)"/);
      if (subMatch) {
        var rawSubs = subMatch[1].split(",");
        for (var i = 0; i < rawSubs.length; i++) {
          var parts = rawSubs[i].match(/\[(.*?)\](.*)/);
          if (parts) {
            var label = parts[1].trim();
            var subUrl = parts[2].trim();
            var isTr = label.toLowerCase().includes("türk") || label.toLowerCase().startsWith("tr");
            var langCode = isTr ? "tr" : "en";
            subList.push({
              id: isTr ? "tur" : "en",
              url: subUrl,
              lang: langCode,
              language: langCode,
              label: label,
              name: label,
              title: label
            });
          }
        }
      }

      return {
        url: streamJson.url,
        name: movieTitle,
        title: PROVIDER_NAME + ' | Türkçe Altyazılı',
        quality: '1080p',
        type: 'hls',
        headers: {
          'Referer': streamUrl,
          'User-Agent': HEADERS['User-Agent']
        },
        subtitles: subList,
        behaviorHints: {
          notWebReady: true
        }
      };
    });
  })
  .catch(function() { return null; });
}

function getStreams(imdbId, mediaType, season, episode) {
  var cleanImdbId = String(imdbId).trim();
  var sNum = season || 1;
  var eNum = episode || 1;
  var isTv = (mediaType === 'series' || mediaType === 'tv');

  return fetchTmdbInfo(cleanImdbId, mediaType)
    .then(function(info) {
      info.isTv = isTv;
      var movieName = info.titleTr || info.titleEn;
      
      return findDiziBalItem(info).then(function(matchedItem) {
        if (!matchedItem || !matchedItem._id) return [];

        var streamEmbedUrlPromise;
        if (info.isTv) {
          var epUrl = DIZIBAL_URL + '/api/series/' + matchedItem._id + '/seasons/' + sNum + '/episodes/' + eNum + '/stream';
          streamEmbedUrlPromise = fetch(epUrl, { headers: HEADERS })
            .then(function(r) { return r.json(); })
            .then(function(epJson) {
              return epJson.data && epJson.data.streamUrl;
            });
        } else {
          var slug = matchedItem.slug;
          if (!slug) return Promise.resolve(null);
          var detailUrl = DIZIBAL_URL + '/api/movies/' + slug;
          streamEmbedUrlPromise = fetch(detailUrl, { headers: HEADERS })
            .then(function(r) { return r.json(); })
            .then(function(detailJson) {
              return detailJson.data && detailJson.data.streamUrl;
            });
        }

        return streamEmbedUrlPromise.then(function(streamEmbedUrl) {
          if (!streamEmbedUrl) return [];
          return resolveEmbedStream(streamEmbedUrl, movieName).then(function(stream) {
            return stream ? [stream] : [];
          });
        });
      });
    })
    .catch(function() { return []; });
}

module.exports = { getStreams: getStreams };
