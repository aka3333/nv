// 2

var DIZIBAL_URL = 'https://dizibal.org';
var TMDB_API_KEY = '8c598c9af9b0badc281e95b1890834bc';
var PROVIDER_NAME = 'DiziBal';

var HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': DIZIBAL_URL + '/'
};

// İsteklerin takılı kalmasını önleyen zaman aşımı fonksiyonu (Varsayılan: 5 saniye)
function fetchWithTimeout(url, options, timeoutMs) {
  timeoutMs = timeoutMs || 5000;
  return Promise.race([
    fetch(url, options),
    new Promise(function(_, reject) {
      setTimeout(function() { reject(new Error('Request Timeout')); }, timeoutMs);
    })
  ]).catch(function() { return null; });
}

// Türkçe karakter ve eşleşme sorunlarını ortadan kaldıran temizleyici
function cleanTitle(str) {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/[ığıüşöçİĞÜŞÖÇ]/g, function(m) {
      return { 'ı':'i', 'ğ':'g', 'ü':'u', 'ş':'s', 'ö':'o', 'ç':'c', 'İ':'i', 'Ğ':'g', 'Ü':'u', 'Ş':'s', 'Ö':'o', 'Ç':'c' }[m];
    })
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

// TMDB veya IMDb ID'sinden film/dizi meta verilerini çeker
function fetchTmdbInfo(inputIdentifier, mediaType) {
  var cleanId = String(inputIdentifier).trim();
  var isTv = (mediaType === 'series' || mediaType === 'tv');
  var isNumeric = /^\d+$/.test(cleanId);
  var url;

  if (isNumeric) {
    var endpoint = isTv ? 'tv' : 'movie';
    url = 'https://api.themoviedb.org/3/' + endpoint + '/' + cleanId + '?api_key=' + TMDB_API_KEY + '&language=tr-TR';
    return fetchWithTimeout(url)
      .then(function(r) { return r ? r.json() : null; })
      .then(function(item) {
        return {
          titleTr: (item && (item.title || item.name)) || '',
          titleEn: (item && (item.original_title || item.original_name)) || '',
          id: item && item.id ? String(item.id) : cleanId,
          imdbId: item && item.imdb_id ? String(item.imdb_id) : null,
          isTv: isTv
        };
      })
      .catch(function() {
        return { titleTr: '', titleEn: '', id: cleanId, imdbId: null, isTv: isTv };
      });
  } else {
    url = 'https://api.themoviedb.org/3/find/' + cleanId + '?api_key=' + TMDB_API_KEY + '&external_source=imdb_id&language=tr-TR';
    return fetchWithTimeout(url)
      .then(function(r) { return r ? r.json() : null; })
      .then(function(data) {
        var item = isTv 
          ? ((data && data.tv_results && data.tv_results[0]) || (data && data.movie_results && data.movie_results[0]))
          : ((data && data.movie_results && data.movie_results[0]) || (data && data.tv_results && data.tv_results[0]));
        
        return {
          titleTr: (item && (item.title || item.name)) || '',
          titleEn: (item && (item.original_title || item.original_name)) || '',
          id: item && item.id ? String(item.id) : null,
          imdbId: cleanId,
          isTv: isTv
        };
      })
      .catch(function() {
        return { titleTr: '', titleEn: '', id: null, imdbId: cleanId, isTv: isTv };
      });
  }
}

// DiziBal arama fonksiyonu
function performSearch(query, isTv) {
  var type = isTv ? "series" : "movies";
  var searchUrl = DIZIBAL_URL + '/api/' + type + '?search=' + encodeURIComponent(query) + '&page=1&limit=20&siteMode=full';
  
  return fetchWithTimeout(searchUrl, { headers: HEADERS })
    .then(function(r) { return r ? r.json() : null; })
    .then(function(json) { return (json && json.data) || []; })
    .catch(function() { return []; });
}

// Arama sonuçları içinden en doğru eşleşmeyi bulan akıllı süzgeç
function findDiziBalItem(tmdbInfo, originalInputId) {
  var queries = [tmdbInfo.titleEn, tmdbInfo.titleTr].filter(Boolean);

  function trySearch(index) {
    if (index >= queries.length) {
      return performSearch(originalInputId, tmdbInfo.isTv).then(function(resList) {
        return resList.find(function(r) {
          var rId = r.id ? String(r.id) : "";
          var rImdb = r.imdb_id ? String(r.imdb_id).toLowerCase() : "";
          return (tmdbInfo.id && rId === tmdbInfo.id) || 
                 (tmdbInfo.imdbId && rImdb === tmdbInfo.imdbId.toLowerCase()) ||
                 (rImdb === String(originalInputId).toLowerCase());
        }) || null;
      });
    }

    var query = queries[index];
    return performSearch(query, tmdbInfo.isTv).then(function(resList) {
      var found = resList.find(function(r) {
        var rId = r.id ? String(r.id) : "";
        var rImdb = r.imdb_id ? String(r.imdb_id).toLowerCase() : "";
        var rTitle = cleanTitle(r.title || r.name || '');
        
        return (tmdbInfo.id && rId === tmdbInfo.id) || 
               (tmdbInfo.imdbId && rImdb === tmdbInfo.imdbId.toLowerCase()) ||
               (rTitle === cleanTitle(query));
      });
      return found || trySearch(index + 1);
    });
  }

  return trySearch(0);
}

// DiziBal embed oynatıcı sayfasını ve altyazıları çözen fonksiyon
function resolveEmbedStream(streamUrl) {
  var u;
  try {
    u = new URL(streamUrl);
  } catch (e) {
    return Promise.resolve(null);
  }

  return fetchWithTimeout(streamUrl, {
    headers: {
      'User-Agent': HEADERS['User-Agent'],
      'Referer': DIZIBAL_URL + '/'
    }
  })
  .then(function(r) { return r ? r.text() : null; })
  .then(function(html) {
    if (!html) return null;

    var getStreamMatch = html.match(/fetch\(['"](\/dl\?op=get_stream[^'"]+)['"]/);
    if (!getStreamMatch) return null;

    var streamApiUrl = u.origin + getStreamMatch[1];
    return fetchWithTimeout(streamApiUrl, {
      headers: {
        'User-Agent': HEADERS['User-Agent'],
        'Referer': streamUrl,
        'Origin': u.origin,
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
    .then(function(res) { return res ? res.json() : null; })
    .then(function(streamJson) {
      if (!streamJson || !streamJson.url) return null;

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
            if (!isTr) continue;

            if (subUrl.startsWith('/')) {
              subUrl = u.origin + subUrl;
            }

            subList.push({
              id: "tur",
              url: subUrl,
              lang: "tr",
              language: "tr",
              label: label,
              name: label,
              title: label
            });
          }
        }
      }

      var hasTurkishSub = subList.length > 0;
      var languageStatus = hasTurkishSub ? "Türkçe Altyazı" : "";

      var titleParts = [
        "HLS",
        languageStatus
      ].filter(Boolean);

      return {
        name: PROVIDER_NAME,
        title: titleParts.join(' | '),
        url: streamJson.url,
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

// Ana Tetikleyici Fonksiyon
function getStreams(identifier, mediaType, season, episode) {
  var cleanInput = String(identifier).trim();
  var sNum = season || 1;
  var eNum = episode || 1;
  var isTv = (mediaType === 'series' || mediaType === 'tv');

  return fetchTmdbInfo(cleanInput, mediaType)
    .then(function(info) {
      info.isTv = isTv;

      return findDiziBalItem(info, cleanInput).then(function(matchedItem) {
        if (!matchedItem || !matchedItem._id) return [];

        var streamEmbedUrlPromise;
        if (info.isTv) {
          var epUrl = DIZIBAL_URL + '/api/series/' + matchedItem._id + '/seasons/' + sNum + '/episodes/' + eNum + '/stream';
          streamEmbedUrlPromise = fetchWithTimeout(epUrl, { headers: HEADERS })
            .then(function(r) { return r ? r.json() : null; })
            .then(function(epJson) {
              return epJson && epJson.data && epJson.data.streamUrl;
            });
        } else {
          var slug = matchedItem.slug;
          if (!slug) return Promise.resolve(null);
          var detailUrl = DIZIBAL_URL + '/api/movies/' + slug;
          streamEmbedUrlPromise = fetchWithTimeout(detailUrl, { headers: HEADERS })
            .then(function(r) { return r ? r.json() : null; })
            .then(function(detailJson) {
              return detailJson && detailJson.data && detailJson.data.streamUrl;
            });
        }

        return streamEmbedUrlPromise.then(function(streamEmbedUrl) {
          if (!streamEmbedUrl) return [];
          return resolveEmbedStream(streamEmbedUrl).then(function(stream) {
            return stream ? [stream] : [];
          });
        });
      });
    })
    .catch(function() { return []; });
}

module.exports = { getStreams: getStreams };
