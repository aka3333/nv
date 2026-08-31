// v1
var DIZIBAL_URL = 'https://dizibal.org';
var TMDB_API_KEY = '8c598c9af9b0badc281e95b1890834bc';
var PROVIDER_NAME = 'DiziBal';

var HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': DIZIBAL_URL + '/'
};

function fetchTmdbInfo(tmdbId, mediaType) {
  var cleanId = String(tmdbId).trim();
  var isTv = mediaType !== "movie";

  if (cleanId.startsWith("tt")) {
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
          id: item ? item.id : null,
          isTv: isTv
        };
      });
  } else {
    var endpoint = isTv ? 'tv' : 'movie';
    return fetch('https://api.themoviedb.org/3/' + endpoint + '/' + cleanId + '?api_key=' + TMDB_API_KEY + '&language=tr-TR')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        return {
          titleTr: d.title || d.name || '',
          titleEn: d.original_title || d.original_name || '',
          id: d.id,
          isTv: isTv
        };
      });
  }
}

function sanitizeTitle(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
    .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTitleMatch(t1, t2) {
  var s1 = sanitizeTitle(t1);
  var s2 = sanitizeTitle(t2);
  if (!s1 || !s2) return false;
  return s1 === s2 || s1.includes(s2) || s2.includes(s1);
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
  var titles = [tmdbInfo.titleTr, tmdbInfo.titleEn].filter(Boolean);
  
  function trySearch(index) {
    if (index >= titles.length) return Promise.resolve(null);
    var query = titles[index];
    
    return performSearch(query, tmdbInfo.isTv).then(function(results) {
      var found = results.find(function(r) {
        var rTmdb = r.id ? String(r.id) : "";
        if (tmdbInfo.id && rTmdb === String(tmdbInfo.id)) return true;
        var rTitle = r.name_tr || r.name_en || r.name || r.title_tr || r.title_en || r.title;
        return isTitleMatch(query, rTitle);
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

function getStreams(tmdbId, mediaType, season, episode) {
  var sNum = season || 1;
  var eNum = episode || 1;
  var isTv = (mediaType === 'series' || mediaType === 'tv');

  return fetchTmdbInfo(tmdbId, mediaType)
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
