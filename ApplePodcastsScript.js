const PLATFORM = "Apple Podcasts";
const PLATFORM_BASE_URL = "https://podcasts.apple.com";
const PLATFORM_BASE_URL_API = 'https://amp-api.podcasts.apple.com'
const PLATFORM_BASE_ASSETS_URL = "https://podcasts.apple.com/assets/";
const URL_CHANNEL = "https://podcasts.apple.com/us/podcast/";

const API_SEARCH_URL_TEMPLATE = 'https://amp-api.podcasts.apple.com/v1/catalog/us/search/groups?groups=episode&l=en-US&offset=25&term={0}&types=podcast-episodes&platform=web&extend[podcast-channels]=availableShowCount&include[podcast-episodes]=channel,podcast&limit=25&with=entitlements';
const API_SEARCH_PODCASTS_URL_TEMPLATE = 'https://itunes.apple.com/search?media=podcast&term={0}';
const API_GET_PODCAST_EPISODES_URL_TEMPLATE = 'https://amp-api.podcasts.apple.com/v1/catalog/{0}/podcasts/{1}/episodes?l=en-US&offset={2}';
const API_GET_EPISODE_DETAILS_URL_TEMPLATE = 'https://amp-api.podcasts.apple.com/v1/catalog/{0}/podcast-episodes/{1}?include=channel,podcast&include[podcasts]=episodes,podcast-seasons,trailers&include[podcast-seasons]=episodes&fields=artistName,artwork,assetUrl,contentRating,description,durationInMilliseconds,episodeNumber,guid,isExplicit,kind,mediaKind,name,offers,releaseDateTime,season,seasonNumber,storeUrl,summary,title,url&with=entitlements&l=en-US';

const API_GET_TRENDING_EPISODES_URL_PATH_TEMPLATE = '/v1/catalog/{country}/charts?chart=top&genre=26&l=en-US&limit=10&offset=0&types=podcast-episodes'
const API_GET_TRENDING_EPISODES_URL_QUERY_PARAMS = 'extend[podcasts]=editorialArtwork,feedUrl&include[podcast-episodes]=podcast&types=podcast-episodes&with=entitlements';

const REGEX_CONTENT_URL = /https:\/\/podcasts\.apple\.com\/[a-zA-Z]*\/podcast\/.*?\/id([0-9]*)\?i=([0-9]*).*?/s
const REGEX_CHANNEL_URL = /https:\/\/podcasts\.apple\.com\/[a-zA-Z]{2}\/podcast(?:\/[^/]+)?\/(?:id)?([0-9]+)/si;
const REGEX_CHANNEL_SHOW = /<script id=schema:show type="application\/ld\+json">(.*?)<\/script>/s
const REGEX_CHANNEL_TOKENS = /<meta name="web-experience-app\/config\/environment" content="(.*?)"/s
const REGEX_EPISODE = /<script name="schema:podcast-episode" type="application\/ld\+json">(.*?)<\/script>/s
const REGEX_IMAGE = /<meta property="og:image" content="(.*?)">/s
const REGEX_CANONICAL_URL = /<link rel="canonical" href="(https:\/\/podcasts.apple.com\/[a-zA-Z]*\/podcast\/.*?)">/s
const REGEX_SHOEBOX_PODCAST = /<script type="fastboot\/shoebox" id="shoebox-media-api-cache-amp-podcasts">(.*?)<\/script>/s
const REGEX_MAIN_SCRIPT_FILENAME = /index-\w+\.js/;
const REGEX_JWT = /\beyJhbGci[A-Za-z0-9-_]+?\.[A-Za-z0-9-_]+?\.[A-Za-z0-9-_]{43,}\b/;
const REGEX_EPISODE_ID = /[?&]i=([^&]+)/;
const REGEX_COUNTRY_CODE = /^https:\/\/podcasts\.apple\.com\/([a-z]{2})\//;

let state = {
	headers: {},
	channel: {}
};

let COUNTRY_CODES = [];


let config = {};
let _settings = {
	countryIndex: 0,
	allowExplicit: false
};

//Source Methods
source.enable = function(conf, settings, savedState){
	try {
		config = conf ?? {};
		_settings = settings ?? {};

		if (IS_TESTING) {
			_settings.countryIndex = 0; //countrycode=us
			_settings.allowExplicit = false;
		}
		
		COUNTRY_CODES = loadOptionsForSetting('countryIndex').map((c) => c.toLowerCase().split(' - ')[0]);

		let didSaveState = false;
	  
		try {
		  if (savedState) {
			const saveState = JSON.parse(savedState);
			if (saveState) {
			  Object.keys(state).forEach((key) => {
				state[key] = saveState[key];
			  });
			}
			didSaveState = true;
		  }
		} catch (ex) {
		  log('Failed to parse saveState:' + ex);
		}
	  
		if (!didSaveState) {
		  // init state
		  const indexRes = http.GET(PLATFORM_BASE_URL, {});
		  if(!indexRes.isOk) {
			  throw new ScriptException("Failed to get index page [" + indexRes.code + "]");
		  }
	
		  // Extract the main script file name from the index page
		  const scriptFileName = extractScriptFileName(indexRes.body);

		  if(!scriptFileName) {
			  throw new ScriptException("Failed to extract script file name");
		  }
		  
		  // Get the main script file content
		  const scriptRes = http.GET(`${PLATFORM_BASE_ASSETS_URL}${scriptFileName}`, {});
		  if(!scriptRes.isOk) {
			  throw new ScriptException(`Failed to get script file ${scriptFileName} [" ${scriptRes.code } "]`);
		  }
	  
		  // Extract the JWT token from the main script content
		  const token = extractJWT(scriptRes.body);
	
		  if(!token) {
			  throw new ScriptException("Failed to extract Token");
		  }
	
		  state.headers = { Authorization: `Bearer ${token}`, Origin: PLATFORM_BASE_URL};
		  
		}
	} catch(e) {
		console.error(e);
	}
}

source.getHome = function () {

    const selectedCountry = COUNTRY_CODES[_settings.countryIndex];
    const requestPath = API_GET_TRENDING_EPISODES_URL_PATH_TEMPLATE.replace("{country}", selectedCountry);

    class RecommendedVideoPager extends VideoPager {
        constructor({ media = [], hasMore = true, context = { requestPath } } = {}) {
            super(media, hasMore, context);
            this.url = `${PLATFORM_BASE_URL_API}/${context.requestPath}&${API_GET_TRENDING_EPISODES_URL_QUERY_PARAMS}`;
        }

        nextPage() {
            const resp = http.GET(this.url, state.headers);

            if (!resp.isOk)
                return new ContentPager([], false);

            const episodes = JSON.parse(resp.body)?.results?.['podcast-episodes']?.find(x => x.chart == "top");

            const contents = (episodes?.data ?? [])
                .map(x => {
                    const podcast = x.relationships?.podcast?.data?.find(p => p.type == 'podcasts');
                    const podcastAttributes = podcast?.attributes;
                    return new PlatformVideo({
                        id: new PlatformID(PLATFORM, x.id + "", config?.id),
                        name: x.attributes.itunesTitle ?? x.attributes.name ?? '',
                        thumbnails: new Thumbnails([new Thumbnail(getArtworkUrl(x.attributes.artwork.url), 0)]),
                        author: new PlatformAuthorLink(new PlatformID(PLATFORM, podcast.id, config.id, undefined), podcastAttributes?.name, podcastAttributes.url, getArtworkUrl(podcastAttributes.artwork.url) ?? ""),
                        uploadDate: parseInt(new Date(x.attributes.releaseDateTime).getTime() / 1000),
                        duration: x.attributes.durationInMilliseconds / 1000,
                        viewCount: -1,
                        url: x.attributes.url,
                        isLive: false
                    })
                })
                .sort((a, b) => b.datetime - a.datetime);

            return new RecommendedVideoPager({
                media: contents,
                hasMore: !!episodes.next,
                context: { requestPath: episodes.next },
            });
        }
    }

    return new RecommendedVideoPager({ context: { requestPath } }).nextPage();

};

source.searchSuggestions = function(query) {
	return [];
};
source.getSearchCapabilities = () => {
	return {
		types: [Type.Feed.Mixed],
		sorts: [Type.Order.Chronological],
		filters: [ ]
	};
};
source.search = function (query, type, order, filters) {
	const url = API_SEARCH_URL_TEMPLATE.replace("{0}", query);
	const resp = http.GET(url, state.headers);
	
	if(!resp.isOk)
		throw new ScriptException("Failed to get search results [" + resp.code + "]");
	const result = JSON.parse(resp.body);
	
	const results = result.results.groups
	.find(x=>x.groupId == "episode")?.data
	.map(x=>{
		
	const podcast = x.relationships?.podcast?.data?.find(p => p.type == 'podcasts');
	const podcastAttributes = podcast?.attributes;

	return new PlatformVideo({
		id: new PlatformID(PLATFORM, x.id + "", config?.id),
		name: x?.attributes?.name ?? '',
		thumbnails: new Thumbnails([new Thumbnail(getArtworkUrl(x.attributes.artwork.url), 0)]),
		author: new PlatformAuthorLink(new PlatformID(PLATFORM, podcast.id, config.id, undefined), podcastAttributes?.name ?? '', podcastAttributes.url, getArtworkUrl(podcastAttributes.artwork.url) ?? ""),
		uploadDate: parseInt(new Date(x.attributes.releaseDateTime).getTime() / 1000),
		duration: x.attributes.durationInMilliseconds / 1000,
		viewCount: -1,
		url: x.attributes.url,
		isLive: false
	})});

	return new ContentPager(results, false);
};
source.getSearchChannelContentsCapabilities = function () {
	return {
		types: [Type.Feed.Mixed],
		sorts: [Type.Order.Chronological],
		filters: []
	};
};
source.searchChannels = function(query) {
	const url = API_SEARCH_PODCASTS_URL_TEMPLATE.replace("{0}", query);
	const resp = http.GET(url, {});
	if(!resp.isOk)
		throw new ScriptException("Failed to get search results [" + resp.code + "]");
	const result = JSON.parse(resp.body);
	const results = result.results.map(x=>new PlatformAuthorLink(new PlatformID(PLATFORM, "" + x.artistId, config.id, undefined), x?.collectionName ?? x?.trackName ?? x?.collectionCensoredName ?? '', x.collectionViewUrl, x.artworkUrl100 ?? ""));

	return new ChannelPager(results, false);
};

//Channel
source.isChannelUrl = function(url) {
	return REGEX_CHANNEL_URL.test(url);
};
source.getChannel = function(url) {
	const matchUrl = url.match(REGEX_CHANNEL_URL);

	const podcastId = matchUrl[1];

	// check if channel is cached and return it
	if(state.channel[podcastId]) {
		return state.channel[podcastId];
	}

	const resp = http.GET(url, {});
	if(!resp.isOk)
		throw new ScriptException("Failed to get channel [" + resp.code + "]");

	const showMatch = resp.body.match(REGEX_CHANNEL_SHOW);
	if(!showMatch || showMatch.length != 2) {
		console.log("No show data", resp.body);
		throw new ScriptException("Could not find show data");
	}
	const showData = JSON.parse(showMatch[1]);

	const banner = matchFirstOrDefault(resp.body, REGEX_IMAGE);
	// save channel info to state (cache)
	state.channel[podcastId] = new PlatformChannel({
		id: new PlatformID(PLATFORM, podcastId, config.id, undefined),
		name: showData.name,
		thumbnail: banner,
		banner: banner,
		subscribers: -1,
		description: showData.description,
		url: removeQuery(url),
		urlAlternatives: [removeQuery(url)],
		links: {}
	});

	return state.channel[podcastId];
};

source.getChannelContents = function(url) {
	const id = removeRemainingQuery(url.match(REGEX_CHANNEL_URL)[1]);
	return new AppleChannelContentPager(id, extractCountryCode(url));
};
class AppleChannelContentPager extends ContentPager {
	constructor(id, countryCode) {
		super(fetchEpisodesPage(id, 0, countryCode), true);
		this.offset = this.results.length;
		this.id = id;
		this.countryCode = countryCode;
	}

	nextPage() {
		this.offset += 10;
		this.results = fetchEpisodesPage(this.id, this.offset, this.countryCode);
		this.hasMore = this.results.length > 0;
		return this;
	}
}
function fetchEpisodesPage(id, offset=0, countryCode='us') {
	const urlEpisodes = API_GET_PODCAST_EPISODES_URL_TEMPLATE
	.replace("{0}", countryCode)
	.replace("{1}", id)
	.replace("{2}", offset);
	const resp = http.GET(urlEpisodes, state.headers);
	if(!resp.isOk)
		return [];

	const channelUrl = `${URL_CHANNEL}id${id}`;
	
	const channel = source.getChannel(channelUrl); 	// cached request
	const author = new PlatformAuthorLink(new PlatformID(PLATFORM, id, config.id, undefined), channel.name, URL_CHANNEL + id, channel.thumbnail);

	const episodes = JSON.parse(resp.body);

	return episodes.data.map(x=> { 

		return new PlatformVideo({
		id: new PlatformID(PLATFORM, "" + x.id, config?.id),
		name: x.attributes.name,
		thumbnails: new Thumbnails([new Thumbnail(getArtworkUrl(x.attributes.artwork.url), 0)]),
		author: author,
		uploadDate: parseInt(new Date(x.attributes.releaseDateTime).getTime() / 1000),
		duration: parseInt(x.attributes.durationInMilliseconds / 1000),
		viewCount: -1,
		url: x.attributes.url,
		isLive: false,
		description: x.attributes.description.standard,
		video: getVideoSource(x)
	})});
}

//Video
source.isContentDetailsUrl = function(url) {
	return REGEX_CONTENT_URL.test(url);
};

source.getContentDetails = function(url) {

	const episodeId = extractEpisodeId(url);

	if(!episodeId) {
		throw new ScriptException(`Failed to extract episode id from url ${url}`);
	}
	
	const episodeApiUrl = API_GET_EPISODE_DETAILS_URL_TEMPLATE
	.replace("{0}", extractCountryCode(url))
	.replace("{1}", episodeId);

	const resp = http.GET(episodeApiUrl, state.headers, false);
	
	if(!resp.isOk)
	{
		throw new ScriptException("Failed to get content details [" + resp.code + "]");
	}

	const episodeData = JSON.parse(resp.body).data.find(x => x.type == "podcast-episodes");

	if(!episodeData?.attributes?.assetUrl) {
		throw new UnavailableException("This episode is not available yet");
	}

	if(episodeData.attributes.contentRating == 'explicit' && !_settings["allowExplicit"]) {
		throw new UnavailableException("Explicit videos can be allowed using the plugin settings");
	}

	const podcastData = episodeData.relationships.podcast.data.find(r => r.type == 'podcasts');	

	return new PlatformVideoDetails({
		id: new PlatformID(PLATFORM, episodeData.id, config?.id),
		name: episodeData.attributes.name,
		thumbnails: new Thumbnails([new Thumbnail(getArtworkUrl(episodeData.attributes.artwork.url), 0)]),
		author: new PlatformAuthorLink(new PlatformID(PLATFORM, podcastData.id, config.id, undefined), podcastData.attributes.name, podcastData.attributes.url, getArtworkUrl(podcastData.attributes.artwork.url)),
		uploadDate: parseInt(new Date(episodeData.attributes.releaseDateTime).getTime() / 1000),
		duration: parseInt(episodeData.attributes.durationInMilliseconds / 1000),
		viewCount: -1,
		url: episodeData.attributes.url,
		isLive: false,
		description: episodeData.attributes.description.standard,
		video: getVideoSource(episodeData)
	});
};

source.saveState = () => {
	return JSON.stringify(state);
};

/**
 * Generates a video or audio source descriptor based on the provided episode data.
 * 
 * @param {Object} episodeData - The data object containing episode attributes.
 * @param {Object} episodeData.attributes - The attributes of the episode.
 * @param {string} episodeData.attributes.mediaKind - Type of media, either "audio" or "video".
 * @param {string} episodeData.attributes.assetUrl - The URL of the media asset.
 * @param {number} episodeData.attributes.durationInMilliseconds - The duration of the audio in milliseconds.
 * 
 * @returns {(UnMuxVideoSourceDescriptor|VideoSourceDescriptor)} - A descriptor for audio or video sources.
 * 
 * @throws {ScriptException} Throws an error if the media kind is not supported.
 * 
 * @example
 * const episodeData = {
 *   attributes: {
 *     mediaKind: "audio",
 *     assetUrl: "https://example.com/audio.mp3",
 *     durationInMilliseconds: 300000
 *   }
 * };
 * const source = getVideoSource(episodeData);
 * // Returns an UnMuxVideoSourceDescriptor for audio or a VideoSourceDescriptor for video
 */
function getVideoSource(episodeData) {
	switch(episodeData.attributes.mediaKind) {
		case "audio":
			return new UnMuxVideoSourceDescriptor([], [
				new AudioUrlSource({
					name: "Podcast",
					container: "audio/mpeg",
					bitrate: 0,
					url: episodeData.attributes.assetUrl,
					duration: parseInt(episodeData.attributes.durationInMilliseconds / 1000),
					codec: "",
				})
			]);
		case "video":
			return new VideoSourceDescriptor([
				new VideoUrlSource({
					name: "Podcast",
					container: "video/mp4",
					url: episodeData.attributes.assetUrl,
				})
			]);
		default:
			throw new ScriptException(`Unsupported media kind: "${episodeData.attributes.mediaKind}" for url: ${episodeData.attributes.assetUrl}`);
	}	
}


/**
 * Prepare the artwork URL by replacing the placeholders with the actual values
 * @param {string} url
 * @returns {string}
 */
function getArtworkUrl(url) {
	return url
	.replace("{w}", "500")
	.replace("{h}", "500")
	.replace("{f}", "png");
}

/**
 * Match the first group of the regex and return the default value if not found
 * @param {string} data
 * @param {any} regex
 * @param {string} def
 * @returns {string}
 */
function matchFirstOrDefault(data, regex, def) {
	const match = data.match(regex);
	if(match && match.length > 0)
		return match[1];
	return def;
}

/**
 * Remove the remaining query from the URL
 * @param {string} query
 * @returns {string}
 */
function removeRemainingQuery(query) {
	const indexSlash = query.indexOf("/");
	if(indexSlash >= 0)
		return query.substring(0, indexSlash);
	const indexQuestion = query.indexOf("?");
	if(indexQuestion >= 0)
		return query.substring(0, indexQuestion);
	const indexAnd = query.indexOf("&");
	if(indexAnd >= 0)
		return query.substring(0, indexAnd);
	return query;
}
/**
 * Remove the query from the URL
 * @param {string} query
 * @returns {string}
 */
function removeQuery(query) {
	const indexQuestion = query.indexOf("?");
	if(indexQuestion >= 0)
		return query.substring(0, indexQuestion);
	return query;
}

/**
 * Extract the main script file name from the HTML content
 * @param {string} htmlContent
 * @returns {string}
 */
function extractScriptFileName(htmlContent) {
    // Define the regex pattern to match 'index-*.js'
    const match = htmlContent.match(REGEX_MAIN_SCRIPT_FILENAME);
    
    // Return the matched file name if found, otherwise return null
    return match ? match[0] : null;
}

/**
 * Extract the JWT token from the main script
 * Looks for a string that starts with 'eyJhbGci' representing the encoded header
 * @param {string} scriptContent
 * @returns {string}
 */
function extractJWT(scriptContent) {
    // Use the match method to find the JWT token in the script content
    const match = scriptContent.match(REGEX_JWT);
    
    // Return the matched JWT if found, otherwise return null
    return match ? match[0] : null;
}

/**
 * Extract the episode ID from the URL
 * @param {string} url
 * @returns {string}
 */
function extractEpisodeId(url) {
    const match = url.match(REGEX_EPISODE_ID);
    return match ? match[1] : null;
}

/**
 * Returs the options values for a setting. If the setting is not found, an empty array is returned.
 * @param {string} settingKey
 * @returns {string[]}
 */
function loadOptionsForSetting(settingKey) {
	return config?.settings?.find((s) => s.variable == settingKey)
	  ?.options ?? [];
}


/**
 * Extract the country code from the URL since it is needed for the API requests
 * @param {string} url
 * @returns {string}
 */
function extractCountryCode(url) {
    const match = url.match(REGEX_COUNTRY_CODE);
    return match ? match[1] : null; // Returns the country code or null if not found
}

console.log("LOADED");