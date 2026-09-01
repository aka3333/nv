// v1
var DIZIBAL_URL = 'https://dizibal.org';
var TMDB_API_KEY = '8c598c9af9b0badc281e95b1890834bc';
var PROVIDER_NAME = 'DiziBal';

var HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': DIZIBAL_URL + '/'
};

function fetchWithTimeout(url, options, timeoutMs) {
  timeoutMs = timeoutMs || 5000;
  return Promise.race([
    fetch(url, options),
    new Promise(function(_, reject) {
      setTimeout(function() { reject(new Error('Request Timeout')); }, timeoutMs);
    })
  ]).catch(function() { return null; });
}

function cleanTitle(str) {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/[ığıüşöçİĞÜŞÖÇ]/g, function(m) {
      return { 'ı':'i', 'ğ':'g', 'ü':'u', 'ş':'s', 'ö':'o', 'ç':'c', 'İ':'i', 'Ğ':'g', 'Ü':'u', 'Ş':'s', 'Ö':'o', 'Ç':'c' }[m];
    })
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

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

function performSearch(query, isTv) {
  var type = isTv ? "series" : "movies";
  var searchUrl = DIZIBAL_URL + '/api/' + type + '?search=' + encodeURIComponent(query) + '&page=1&limit=20&siteMode=full';
  
  return fetchWithTimeout(searchUrl, { headers: HEADERS })
    .then(function(r) { return r ? r.json() : null; })
    .then(function(json) { return (json && json.data) || []; })
    .catch(function() { return []; });
}

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

function detectQuality(itemData, htmlContent) {
  var rawQuality = (itemData && (itemData.quality || itemData.resolution)) || '';
  if (!rawQuality && htmlContent) {
    var match = htmlContent.match(/(2160p|4K|1080p|FHD|720p|HD)/i);
    if (match) rawQuality = match[1];
  }
  return rawQuality ? String(rawQuality).toUpperCase() : '';
}

function resolveEmbedStream(streamUrl, sourceItemData) {
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
      
      var subRegexes = [
        /"subtitle"\s*:\s*"([^"]+)"/,
        /subtitles\s*:\s*(\[[^\]]+\])/,
        /subtitles\s*:\s*"([^"]+)"/
      ];

      var rawSubText = "";
      for (var s = 0; s < subRegexes.length; s++) {
        var match = html.match(subRegexes[s]);
        if (match && match[1]) {
          rawSubText = match[1];
          break;
        }
      }

      if (rawSubText) {
        var rawEntries = [];
        try {
          if (rawSubText.startsWith('[')) {
            var parsed = JSON.parse(rawSubText);
            for (var p = 0; p < parsed.length; p++) {
              rawEntries.push((parsed[p].label || parsed[p].language || '') + ' ' + (parsed[p].file || parsed[p].url || ''));
            }
          }
        } catch(e) {}

        if (rawEntries.length === 0) {
          rawEntries = rawSubText.split(",");
        }

        for (var i = 0; i < rawEntries.length; i++) {
          var entry = rawEntries[i];
          var parts = entry.match(/\[(.*?)\](.*)/) || entry.match(/["']?label["']?\s*:\s*["']([^"']+)["'].*?["']?file["']?\s*:\s*["']([^"']+)["']/i);
          
          if (!parts) {
            if (entry.toLowerCase().includes("http")) {
              parts = ["", "Türkçe Altyazı", entry.replace(/["']/g, "").trim()];
            }
          }

          if (parts) {
            var label = (parts[1] || "").trim();
            var subUrl = (parts[2] || "").trim();
            
            var lowerLabel = label.toLowerCase();
            var isTr = lowerLabel.includes("türk") || lowerLabel.includes("tr") || lowerLabel.includes("turkish") || lowerLabel === "";
            if (!isTr && label !== "") continue;

            if (subUrl.startsWith('/')) {
              subUrl = u.origin + subUrl;
            }

            if (subUrl) {
              subList.push({
                id: "tur_" + i,
                url: subUrl,
                lang: "tr",
                language: "tr",
                label: label || "Türkçe Altyazı",
                name: label || "Türkçe Altyazı",
                title: label || "Türkçe Altyazı"
              });
            }
          }
        }
      }

      var hasTurkishSub = subList.length > 0;
      var dynamicQuality = detectQuality(sourceItemData, html);
      
      var formatType = "HLS";
      var codecType = "H264";
      var langLabel = hasTurkishSub ? "Türkçe Altyazı" : "Türkçe Dublaj";

      var titleParts = [
        formatType,
        codecType,
        langLabel
      ].filter(Boolean);

      return {
        name: PROVIDER_NAME,
        title: [dynamicQuality, titleParts.join(' | ')].filter(Boolean).join(' - '),
        url: streamJson.url,
        quality: dynamicQuality ? dynamicQuality.toLowerCase() : undefined,
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
        var activeItemData = matchedItem;

        if (info.isTv) {
          var epUrl = DIZIBAL_URL + '/api/series/' + matchedItem._id + '/seasons/' + sNum + '/episodes/' + eNum + '/stream';
          streamEmbedUrlPromise = fetchWithTimeout(epUrl, { headers: HEADERS })
            .then(function(r) { return r ? r.json() : null; })
            .then(function(epJson) {
              if (epJson && epJson.data) {
                activeItemData = epJson.data;
                return epJson.data.streamUrl;
              }
              return null;
            });
        } else {
          var slug = matchedItem.slug;
          if (!slug) return Promise.resolve(null);
          var detailUrl = DIZIBAL_URL + '/api/movies/' + slug;
          streamEmbedUrlPromise = fetchWithTimeout(detailUrl, { headers: HEADERS })
            .then(function(r) { return r ? r.json() : null; })
            .then(function(detailJson) {
              if (detailJson && detailJson.data) {
                activeItemData = detailJson.data;
                return detailJson.data.streamUrl;
              }
              return null;
            });
        }

        return streamEmbedUrlPromise.then(function(streamEmbedUrl) {
          if (!streamEmbedUrl) return [];
          return resolveEmbedStream(streamEmbedUrl, activeItemData).then(function(stream) {
            return stream ? [stream] : [];
          });
        });
      });
    })
    .catch(function() { return []; });
}

module.exports = { getStreams: getStreams };
