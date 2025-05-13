const PLATFORM = "Apple Podcasts";
const PLATFORM_BASE_URL = "https://podcasts.apple.com";
const PLATFORM_SAVED_EPISODES_URL = "https://podcasts.apple.com/{country}/library/saved-episodes";
const PLATFORM_BASE_URL_API = 'https://amp-api.podcasts.apple.com'
const PLATFORM_BASE_ASSETS_URL = "https://podcasts.apple.com/assets/";
const URL_CHANNEL = "https://podcasts.apple.com/us/podcast/";

const API_SEARCH_URL_TEMPLATE = 'https://amp-api.podcasts.apple.com/v1/catalog/us/search/groups?groups=episode&l=en-US&offset=25&term={0}&types=podcast-episodes&platform=web&extend[podcast-channels]=availableShowCount&include[podcast-episodes]=channel,podcast&limit=25&with=entitlements';
const API_SEARCH_PODCASTS_URL_TEMPLATE = 'https://itunes.apple.com/search?media=podcast&term={query}';
const API_SEARCH_PODCAST_CHANNELS_URL_TEMPLATE = 'https://amp-api.podcasts.apple.com/v1/catalog/{country}/search/suggestions?platform=web&types=podcast-channels&limit%5Bresults%3AtopResults%5D=10&kinds=topResults&term={query}';
const API_SEARCH_AUTOCOMPLETE_URL_TEMPLATE = 'https://amp-api.podcasts.apple.com/v1/catalog/{country}/search/suggestions?kinds=terms&term={query}';
const API_GET_PODCAST_EPISODES_URL_TEMPLATE = 'https://amp-api.podcasts.apple.com/v1/catalog/{country}/podcasts/{podcast-id}/episodes?l=en-US&offset={offset}';
const API_GET_EPISODE_DETAILS_URL_TEMPLATE = 'https://amp-api.podcasts.apple.com/v1/catalog/{country}/podcast-episodes/{episode-id}?include=channel,podcast&include[podcasts]=episodes,podcast-seasons,trailers&include[podcast-seasons]=episodes&fields=artistName,artwork,assetUrl,contentRating,description,durationInMilliseconds,episodeNumber,guid,isExplicit,kind,mediaKind,name,offers,releaseDateTime,season,seasonNumber,storeUrl,summary,title,url&with=entitlements&l=en-US';
const API_GET_PUBLISHER_CHANNEL_PODCASTS_URL_TEMPLATE = 'https://amp-api.podcasts.apple.com/v1/catalog/{country}/podcast-channels/{channel-id}/view/top-shows?l=en-US&offset={offset}&extend[podcast-channels]=isSubscribed,subscriptionOffers,title&include[podcasts]=channel&include[podcast-episodes]=channel,podcast&limit=20&with=entitlements';
const API_GET_PUBLISHER_CHANNEL_EPISODES_URL_TEMPLATE = 'https://amp-api.podcasts.apple.com/v1/catalog/{country}/podcast-channels/{channel-id}/view/top-episodes?l=en-US&offset={offset}&extend[podcast-channels]=isSubscribed,subscriptionOffers,title&include[podcasts]=channel&include[podcast-episodes]=channel,podcast&limit=20&with=entitlements';

const API_GET_TRENDING_EPISODES_URL_PATH_TEMPLATE = '/v1/catalog/{country}/charts?chart=top&genre=26&l=en-US&limit=10&offset=0&types=podcast-episodes'
const API_GET_TRENDING_EPISODES_URL_QUERY_PARAMS = 'extend[podcasts]=editorialArtwork,feedUrl&include[podcast-episodes]=podcast&types=podcast-episodes&with=entitlements';

const API_GET_SUBSCRIPTIONS_FIRST_PAGE_PATH = '/v1/me/library/podcasts?limit=30&relate[podcasts]=channel&with=entitlements&l=en-US';//next pages are gotten from the next field (cursor) in the response
const API_GET_SAVED_EPISODES_FIRST_PAGE_PATH = '/v1/me/library/podcast-episodes?include[podcast-episodes]=channel,playback-position,podcast&limit=30&fields[podcast-channels]=subscriptionName,isSubscribed&with=entitlements&l=en-US';//next pages are gotten from the next field (cursor) in the response

const REGEX_CONTENT_URL = /https:\/\/podcasts\.apple\.com\/[a-zA-Z]*\/podcast\/.*?\/id([0-9]*)\?i=([0-9]*).*?/s
const REGEX_CHANNEL_URL = /https:\/\/podcasts\.apple\.com\/[a-zA-Z]{2}\/podcast(?:\/[^/]+)?\/(?:id)?([0-9]+)/si;
const REGEX_CHANNEL_SHOW = /<script id=schema:show type="application\/ld\+json">(.*?)<\/script>/s
const REGEX_CHANNEL_SERVER_DATA = /<script\s+(?:[^>]*?\s+)?(?:id=["']serialized-server-data["']\s+type=["']application\/(?:ld\+)?json["']|type=["']application\/(?:ld\+)?json["']\s+id=["']serialized-server-data["'])\s*>(.*?)<\/script>/s;
const REGEX_EPISODE = /<script name="schema:podcast-episode" type="application\/ld\+json">(.*?)<\/script>/s
const REGEX_EPISODE_ID = /[?&]i=([^&]+)/;
const REGEX_IMAGE = /<meta property="og:image" content="(.*?)">/s
const REGEX_CANONICAL_URL = /<link rel="canonical" href="(https:\/\/podcasts.apple.com\/[a-zA-Z]*\/podcast\/.*?)">/s
const REGEX_MAIN_SCRIPT_FILENAME = /index-\w+\.js/;
const REGEX_JWT = /\beyJhbGci[A-Za-z0-9-_]+?\.[A-Za-z0-9-_]+?\.[A-Za-z0-9-_]{43,}\b/;
const REGEX_COUNTRY_CODE = /^https:\/\/podcasts\.apple\.com\/([a-z]{2})\//;
const REGEX_PUBLISHER_CHANNEL_URL = /https:\/\/podcasts\.apple\.com\/([a-z]{2})\/channel\/([^\/]+)\/(?:id)?([0-9]+)/si;

const SAVED_EPISODES_KEY  = 'applepodcasts:playlist:savedepisodes';

let state = {
	headers: {},
	channel: {}
};

let COUNTRY_CODES = [];


let config = {};
let _settings = {
	countryIndex: 0,
	allowExplicit: false,
	contentRecommendationOptionIndex: 0,
	hideSubscriberOnly: false
};

//Source Methods
source.enable = function(conf, settings, savedState){
	try {
		config = conf ?? {};
		_settings = settings ?? {};

		if(_settings.countryIndex == undefined) {
			_settings.countryIndex = 0;
		}

		if(_settings.allowExplicit == undefined) {
			_settings.allowExplicit = false;
		}

		if(IS_TESTING) {
			_settings.allowExplicit = true;
		}

		if(_settings.hideSubscriberOnly == undefined) {
			_settings.hideSubscriberOnly = false;
		}

		if(_settings.contentRecommendationOptionIndex == undefined) {
			_settings.contentRecommendationOptionIndex = 0;
		}
		
		COUNTRY_CODES = loadOptionsForSetting('countryIndex').map((c) => c.toLowerCase().split(' - ')[0]);

		let didSaveState = false;
	  
		try {
		  if (savedState) {
			state = JSON.parse(savedState);
			didSaveState = true;
		  }
		} catch (ex) {
		  log('Failed to parse saveState:' + ex);
		}
	  
		if (!didSaveState) {
		  // init state
		  const indexHtml = makeGetRequest(PLATFORM_BASE_URL, {
			  parseResponse: false,
			  customHeaders: { 'User-Agent': config.authentication.userAgent }
		  });
	
		  // Extract the main script file name from the index page
		  const scriptFileName = extractScriptFileName(indexHtml);
		  if(!scriptFileName) {
			  throw new ScriptException("Failed to extract script file name");
		  }
		  
		  // Get the main script file content
		  const scriptContent = makeGetRequest(`${PLATFORM_BASE_ASSETS_URL}${scriptFileName}`, {
			  parseResponse: false,
			  customHeaders: { 'User-Agent': config.authentication.userAgent }
		  });
	  
		  // Extract the JWT token from the main script content
		  const token = extractJWT(scriptContent);
	
		  if(!token) {
			  throw new ScriptException("Failed to extract Token");
		  }
	
		  state.headers = { Authorization: `Bearer ${token}`, Origin: PLATFORM_BASE_URL, 'User-Agent': config.authentication.userAgent };
		  
		}
	} catch(e) {
		console.error(e);
	}
}

source.getHome = function () {

    const selectedCountry = COUNTRY_CODES[_settings.countryIndex] ?? 'us';
    const requestPath = API_GET_TRENDING_EPISODES_URL_PATH_TEMPLATE.replace("{country}", selectedCountry);

    class RecommendedVideoPager extends VideoPager {
        constructor({ media = [], hasMore = true, context = { requestPath } } = {}) {
            super(media, hasMore, context);
            this.url = `${PLATFORM_BASE_URL_API}${context.requestPath}&${API_GET_TRENDING_EPISODES_URL_QUERY_PARAMS}`;
        }

        nextPage() {
            const data = makeGetRequest(this.url, { throwOnError: false });

            if (!data)
                return new ContentPager([], false);

            const episodes = data?.results?.['podcast-episodes']?.find(x => x.chart == "top");

            const contents = (episodes?.data ?? [])
                .map(x => podcastToPlatformVideo(x))
				.filter(Boolean)
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

source.searchSuggestions = function (query) {
    try {
        

		const selectedCountry = COUNTRY_CODES[_settings.countryIndex] ?? 'us';
    	
		const requestPath = API_SEARCH_AUTOCOMPLETE_URL_TEMPLATE
			.replace("{country}", selectedCountry)
			.replace("{query}", encodeURIComponent(query))

		const res = makeGetRequest(requestPath, { throwOnError: false });

		if (!res) {
			return [];
		}

		return res?.results?.suggestions?.map(e => e.searchTerm) ?? [];
    }
    catch (error) {
        log('Failed to get search suggestions:' + error?.message);
        return [];
    }
};
source.getSearchCapabilities = () => {
	return {
		types: [Type.Feed.Mixed],
		sorts: [Type.Order.Chronological],
		filters: [ ]
	};
};
source.search = function (query, type, order, filters) {
	const url = API_SEARCH_URL_TEMPLATE.replace("{0}", encodeURIComponent(query));
    
	const result = makeGetRequest(url, { throwOnError: false });
	if (!result) {
        return new ContentPager([], false);
    }
    
    const episodes = result.results.groups
	.find(x => x.groupId == "episode")?.data || [];
        
	const results = episodes
	.map(x => podcastToPlatformVideo(x))
	.filter(Boolean)

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
	const urlRequestPodcasts = API_SEARCH_PODCASTS_URL_TEMPLATE.replace("{query}", encodeURIComponent(query));

	const podcastRes = makeGetRequest(urlRequestPodcasts, { throwOnError: false });
	if (!podcastRes) {
		return new ChannelPager([], false);
	}

	let podcastChannels = [];
	const podcastsResults = podcastRes.results.map(x=>new PlatformAuthorLink(new PlatformID(PLATFORM, "" + x.artistId, config.id, undefined), x?.collectionName ?? x?.trackName ?? x?.collectionCensoredName ?? '', x.collectionViewUrl, x.artworkUrl100 ?? ""));

	const selectedCountry = COUNTRY_CODES[_settings.countryIndex] ?? 'us';

	const urlRequestPodcastChannel = API_SEARCH_PODCAST_CHANNELS_URL_TEMPLATE
	.replace("{country}", selectedCountry)
	.replace("{query}", encodeURIComponent(query));


	const result = makeGetRequest(urlRequestPodcastChannel, { throwOnError: false });
	
	result.results.suggestions.forEach(suggestion => {
		if (suggestion.kind === 'topResults' && suggestion.content) {
			const content = suggestion.content;

			if (content.type === 'podcast-channels') {
				const channel = content;
				podcastChannels.push(new PlatformAuthorLink(
					new PlatformID(PLATFORM, channel.id, config.id, undefined),
					channel.attributes.name,
					channel.attributes.url,
					getArtworkUrl(channel.attributes.artwork.url)
				));
			}
		}
	});

	

	return new ChannelPager([...podcastChannels, ...podcastsResults], false);
};

//Channel
source.isChannelUrl = function(url) {
	return REGEX_CHANNEL_URL.test(url) || REGEX_PUBLISHER_CHANNEL_URL.test(url);
};

source.getChannel = function(url) {
    // Check if it's a publisher channel URL
    const publisherMatch = url.match(REGEX_PUBLISHER_CHANNEL_URL);
    if (publisherMatch) {
        const countryCode = publisherMatch[1];
        const channelId = publisherMatch[3];
        
        // If already cached, return it
        if (state.channel[channelId]) {
            return state.channel[channelId];
        }
        
        const apiUrl = `https://amp-api.podcasts.apple.com/v1/catalog/${countryCode}/podcast-channels/${channelId}?l=en-US`;
        
        const channelData = makeGetRequest(apiUrl, { throwOnError: false });
        if (!channelData) {
            throw new ScriptException("Failed to get publisher channel");
        }
        
        const attributes = channelData.data[0].attributes;
        
        state.channel[channelId] = new PlatformChannel({
            id: new PlatformID(PLATFORM, channelId, config.id, undefined),
            name: attributes.name,
            thumbnail: getArtworkUrl(attributes.artwork.url),
            banner: attributes.logoArtwork ? getArtworkUrl(attributes.logoArtwork.url) : null,
            subscribers: -1,
            description: attributes.description?.standard || '',
            url: url,
            urlAlternatives: [url],
            links: { website: attributes.websiteUrl || '' }
        });
        
        return state.channel[channelId];
    }
    
    // Regular podcast channel handling
    const matchUrl = url.match(REGEX_CHANNEL_URL);
    const podcastId = matchUrl[1];

    // check if channel is cached and return it
    if(state.channel[podcastId]) {
        return state.channel[podcastId];
    }

	const channelUrl = removeQueryParams(url);

    const htmlContent = makeGetRequest(channelUrl, { 
        parseResponse: false,
        throwOnError: false
    });

    if (!htmlContent)
        throw new ScriptException("Failed to get channel page");

    const showMatch = htmlContent.match(REGEX_CHANNEL_SHOW);
    if(!showMatch || showMatch.length != 2) {
        console.log("No show data", resp.body);
        throw new ScriptException("Could not find show data");
    }
    const showData = JSON.parse(showMatch[1]);

	const serverDataMatch = htmlContent.match(REGEX_CHANNEL_SERVER_DATA);
	let serverData;
	if(serverDataMatch && serverDataMatch.length == 2) {
		serverData = JSON.parse(serverDataMatch[1]);
	}

	let description = showData.description ?? '';
	const links = {};

	let items = serverData?.[0]?.data?.shelves?.find(x => x.contentType === 'showHeaderRegular')?.items?.[0];
	const informationItems = serverData?.[0]?.data?.shelves?.find(x => x.contentType === "information")?.items;

	let metaObj;

	try {
		metaObj = (items?.metadata ?? []).reduce((acc, item) => {
			const [key] = Object.keys(item);
			acc[key] = item[key];
			return acc;
		}, {});
	} catch(e) {
		log(`failed to parse metadata: ${e}`);
	}

	let copyrightDescription = '';

	if(informationItems?.length) {
		
		const websiteItem = informationItems.find(item => item.title === 'Show Website');
		
		if(websiteItem) {
			links.website = websiteItem.action.url;
		}

		const episodeCount = informationItems.find(item => item.id === 'InformationShelfEpisodeCount');
		if(episodeCount) {
			description += `<p>${episodeCount.title}: ${episodeCount.description}</p>`;
		}

		const yearActive = informationItems.find(item => item.title === 'Years Active');
		if(yearActive) {
			description += `<p>${yearActive.title}: ${yearActive.description}</p>`;
		}

		const copyright = informationItems.find(item => item.title === 'Copyright');
		if(copyright) {
			copyrightDescription += `<p>${copyright.title}: ${copyright.description}</p>`;
		}
	}

	if(metaObj?.category) {
		const category = metaObj?.category?.title ?? metaObj?.category ?? '';
		if(category) {
			description += `<p>Category: ${category}</p>`;
		}
	}

	if(metaObj?.explicit) {
		description += `<p>Explicit: ${metaObj.explicit ? 'Yes' : 'No'}</p>`;
	};

	if(metaObj?.updateFrequency) {
		description += `<p>Frequency: ${metaObj.updateFrequency}</p>`;
	}

	if(metaObj?.ratings?.ratingAverage) {
		description += `<p>Average Rating: ${metaObj?.ratings?.ratingAverage ?? 0} (votes: ${metaObj?.ratings?.totalNumberOfRatings ?? 0})</p>`;
	}

	description += `<p>Show (${showData.name}): ` + channelUrl + '</p>';

	if(items?.providerAction?.title && items?.providerAction?.pageUrl) {
		description += `<p>Channel (${items.providerAction.title}): ` + items.providerAction.pageUrl+ '</p>';
	}

	description += `${copyrightDescription}`;
	

    const banner = matchFirstOrDefault(htmlContent, REGEX_IMAGE);
    // save channel info to state (cache)
    state.channel[podcastId] = new PlatformChannel({
        id: new PlatformID(PLATFORM, podcastId, config.id, undefined),
        name: showData.name,
        thumbnail: banner,
        banner,
        subscribers: -1,
        description,
        url: removeQueryParams(url),
        links
    });

    return state.channel[podcastId];
};

source.getChannelContents = function(url, type, order, filters, isPlaylist) {
    // Check if it's a publisher channel URL
    if (REGEX_PUBLISHER_CHANNEL_URL.test(url)) {
        return new ApplePublisherChannelEpisodesPager(url);
    }
    
    // Otherwise, handle regular podcast channels
    const id = removeRemainingQuery(url.match(REGEX_CHANNEL_URL)[1]);
    return new AppleChannelContentPager(id, extractCountryCode(url), isPlaylist);
};

source.getChannelPlaylists = function(url) {
    // Check if it's a publisher channel URL
    if (REGEX_PUBLISHER_CHANNEL_URL.test(url)) {
        return new PublisherChannelPlaylistsPager(url);
    }
    
    // Check if it's a regular podcast channel URL
    if (REGEX_CHANNEL_URL.test(url)) {
        return new PodcastEpisodesPlaylistPager(url);
    }
    
    // For other URLs, return empty pager
    return new PlaylistPager([], false);
};

class AppleChannelContentPager extends ContentPager {
	constructor(id, countryCode, isPlaylist) {
		super(fetchEpisodesPage(id, 0, countryCode, isPlaylist), true);
		this.offset = this.results.length;
		this.id = id;
		this.countryCode = countryCode;
		this.isPlaylist = isPlaylist;
		
	}

	nextPage() {
		this.offset += 10;
		
		this.results = fetchEpisodesPage(this.id, this.offset, this.countryCode, this.isPlaylist);
		this.hasMore = this.results.length > 0;
		return this;
	}
}
function fetchEpisodesPage(id, offset=0, countryCode='us', isPlaylist=false) {
	const urlEpisodes = API_GET_PODCAST_EPISODES_URL_TEMPLATE
	.replace("{country}", countryCode)
	.replace("{podcast-id}", id)
	.replace("{offset}", offset);
	const resp = makeGetRequest(urlEpisodes, { throwOnError: false });
	if(!resp)
		return [];

	const channelUrl = `${URL_CHANNEL}id${id}`;
	
	const channel = source.getChannel(channelUrl); 	// cached request
	const author = new PlatformAuthorLink(new PlatformID(PLATFORM, id, config.id, undefined), channel.name, URL_CHANNEL + id, channel.thumbnail);

	return resp.data
	.map(x => podcastToPlatformVideo(x, author, isPlaylist))
	.filter(Boolean)
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
	.replace("{country}", extractCountryCode(url))
	.replace("{episode-id}", episodeId);

	const responseData = makeGetRequest(episodeApiUrl, { useAuth: false });

	if(!responseData)
	{
		throw new ScriptException("Failed to get content details");
	}

	const episodeData = responseData.data.find(x => x.type == "podcast-episodes");

	if(!episodeData?.attributes?.assetUrl) {
		throw new UnavailableException("This episode is not available yet");
	}

	if(episodeData.attributes.contentRating == 'explicit' && !_settings["allowExplicit"]) {
		throw new UnavailableException("Explicit videos can be allowed using the plugin settings");
	}

	const podcastData = episodeData.relationships.podcast.data.find(r => r.type == 'podcasts');

	let description = episodeData.attributes.description?.standard ?? '';

	description += '<h1>Podcast Information</h1>';
	const show = source.getChannel(podcastData.attributes.url);
	description += show.description;

	const result = new PlatformVideoDetails({
		id: new PlatformID(PLATFORM, episodeData.id, config?.id),
		name: episodeData.attributes.name,
		thumbnails: new Thumbnails([new Thumbnail(getArtworkUrl(episodeData.attributes.artwork.url), 0)]),
		author: new PlatformAuthorLink(new PlatformID(PLATFORM, podcastData.id, config.id, undefined), podcastData.attributes.name, podcastData.attributes.url, getArtworkUrl(podcastData.attributes.artwork.url)),
		uploadDate: parseInt(new Date(episodeData.attributes.releaseDateTime).getTime() / 1000),
		duration: parseInt(episodeData.attributes.durationInMilliseconds / 1000),
		viewCount: -1,
		url: episodeData.attributes.url,
		isLive: false,
		description: description,
		video: getVideoSource(episodeData)
	});

	result.getContentRecommendations = function () {

		const contentRecommendationOptionIndex = _settings["contentRecommendationOptionIndex"];

		let noPublisher = false;

		// Content from channel publisher (if any)
		if (contentRecommendationOptionIndex == 0) {
			const channel = episodeData?.relationships?.channel?.data?.[0];

			if (!channel?.attributes?.url) {
				noPublisher = true;
			} else {
				const pager = source.getChannelContents(channel.attributes.url, null, null, null, true);
				pager.results = pager.results.filter(x => x.datetime != result.datetime);
				return pager;
			}
		}
		// Content from podcast channel
		if (contentRecommendationOptionIndex == 1 || noPublisher) {
			const pager = source.getChannelContents(podcastData.attributes.url, null, null, null, true);
			pager.results = pager.results.filter(x => x.datetime != result.datetime);
			return pager;
		}

	};

	if(IS_TESTING) {
		result.getContentRecommendations();
	}

	return result;
};

source.saveState = () => {
	return JSON.stringify(state);
};

source.getUserSubscriptions = () => {
	
	if (!bridge.isLoggedIn()) {
	  log('Failed to retrieve subscriptions page because not logged in.');
	  throw new ScriptException('Not logged in');
	}

	let next = API_GET_SUBSCRIPTIONS_FIRST_PAGE_PATH;
	let hasMore = false;
	const subscriptionUrlList = [];

	do {

		const podcasts = makeGetRequest(`${PLATFORM_BASE_URL_API}${next}`, { 
			useAuth: true,
			throwOnError: false 
		});
		
		if (!podcasts)
			return [];

		podcasts.data.forEach(podcast => {
			subscriptionUrlList.push(podcast.attributes.url);
		});

		hasMore = !!podcasts.next;
		next = podcasts.next;

	} while(hasMore);

	return subscriptionUrlList;
}

source.isPlaylistUrl = function(url) {
    // Return true for saved episodes or podcast URLs
    return url == SAVED_EPISODES_KEY || REGEX_CHANNEL_URL.test(url);
}

source.getUserPlaylists = function () {
	// currently only playlists are saved episodes
	return [SAVED_EPISODES_KEY];
}

source.getPlaylist = function (url) {
	// Check if it's a podcast URL
	if (REGEX_CHANNEL_URL.test(url)) {
		const id = removeRemainingQuery(url.match(REGEX_CHANNEL_URL)[1]);

		// Get the podcast metadata
		const channel = source.getChannel(url);

		const isPlaylist = true;

		const episodesPager = source.getChannelContents(url, null, null, null, isPlaylist);

		return new PlatformPlaylistDetails({
			url: url,
			id: new PlatformID(PLATFORM, id, config.id),
			author: new PlatformAuthorLink(
				new PlatformID(PLATFORM, id, config.id),
				channel.name,
				channel.url,
				channel.thumbnail
			),
			name: channel.name,
			thumbnail: channel.thumbnail,
			// videoCount: episodes.length,
			contents: episodesPager,
		});
	}

	// Handle saved episodes
	if (url == SAVED_EPISODES_KEY) {

		if (!bridge.isLoggedIn()) {
			log('Failed to retrieve saved episodes because not logged in.');
			throw new ScriptException('Not logged in');
		}

		let next = API_GET_SAVED_EPISODES_FIRST_PAGE_PATH;
		let hasMore = false;
		const playlistItems = [];

		do {

			const podcasts = makeGetRequest(`${PLATFORM_BASE_URL_API}${next}`, { 
				useAuth: true,
				throwOnError: false 
			});
			
			if (!podcasts)
				return [];
			podcasts.data.forEach(podcast => {
				playlistItems.push(podcast);
			});

			hasMore = !!podcasts.next;
			next = podcasts.next;

		} while (hasMore);
		const all = playlistItems
			.map(x => podcastToPlatformVideo(x, null, true))
			.filter(Boolean)
			.sort((a, b) => b.datetime - a.datetime);
		const thumbnailUrl = all.length ? (all?.[0]?.thumbnails?.sources?.[0].url ?? '') : '';
		const savedEpisodesPlaylistUrl = PLATFORM_SAVED_EPISODES_URL.replace("{country}", COUNTRY_CODES[_settings.countryIndex]);
		return new PlatformPlaylistDetails({
			url: savedEpisodesPlaylistUrl,
			id: new PlatformID(PLATFORM, 'playlistid', config.id),
			author: new PlatformAuthorLink(
				new PlatformID(PLATFORM, '', config.id),
				'',// author name
				'',// author url
			),
			name: 'Saved Episodes',// playlist name
			thumbnail: thumbnailUrl,
			videoCount: all.length,
			contents: new VideoPager(all),
		});

	}

	throw new ScriptException('Invalid playlist url');
}

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
	if (!episodeData?.attributes?.mediaKind) {
		throw new ScriptException("Media kind not found");
	}
	
	const duration = episodeData.attributes.durationInMilliseconds 
		? parseInt(episodeData.attributes.durationInMilliseconds / 1000)
		: 0;
		
	switch(episodeData.attributes.mediaKind) {
		case "audio":
			return new UnMuxVideoSourceDescriptor([], [
				new AudioUrlSource({
					name: "audio/mp3",
					container: "audio/mp3",
					bitrate: 0,
					url: episodeData.attributes.assetUrl,
					duration: duration,
				})
			]);
		case "video":
			return new VideoSourceDescriptor([
				new VideoUrlSource({
					name: "video/mp4",
					container: "video/mp4",
					url: episodeData.attributes.assetUrl,
					duration: duration,
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
function removeQueryParams(query) {
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
 * Extract the podcast ID from the URL
 * @param {string} url
 * @returns {string}
 */
function extractPodcastId(url) {
    // Regular expression to match the podcast ID in the URL
    const regex = /\/id(\d+)/;
    
    // Match the URL against the regex
    const match = url.match(regex);
    
    // If a match is found, return the podcast ID (without the 'id' prefix)
    if (match) {
        return match[1];
    }
    
    // If no match is found, return null
    return null;
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

function podcastToPlatformVideo(x, author, isPlaylistParent = false) {
	const podcast = x.relationships?.podcast?.data?.find(p => p.type == 'podcasts');
	const podcastAttributes = podcast?.attributes;

	let durationInMilliseconds = x.attributes.durationInMilliseconds;

	let isSubscriberOnly = false;

	if (!durationInMilliseconds) {
		isSubscriberOnly = (x?.attributes?.offers ?? []).some(e => e.kind == 'subscribe');
	}

	let duration = durationInMilliseconds ? durationInMilliseconds / 1000 : 0;

	if (!author) {
		author = new PlatformAuthorLink(new PlatformID(PLATFORM, podcast.id, config.id, undefined), podcastAttributes?.name, podcastAttributes.url, getArtworkUrl(podcastAttributes.artwork.url) ?? "");
	}

	const id = new PlatformID(PLATFORM, x.id + "", config?.id);
	const name = x.attributes.itunesTitle ?? x.attributes.name ?? '';
	const uploadDate = parseInt(new Date(x.attributes.releaseDateTime).getTime() / 1000);

	if (isSubscriberOnly) {

		if(_settings.hideSubscriberOnly || isPlaylistParent) {
			return null;
		}

		return new PlatformLockedContent({
			id,
			name,
			author,
			datetime: uploadDate,
			lockDescription: 'Subscriber only content',
			unlockUrl: 'https://support.apple.com/en-us/108378',
		});
	}

	return new PlatformVideo({
		id,
		name,
		thumbnails: new Thumbnails([new Thumbnail(getArtworkUrl(x.attributes.artwork.url), 0)]),
		author,
		uploadDate,
		duration: duration,
		viewCount: -1,
		url: x.attributes.url,
		isLive: false
	})
}

class PublisherChannelPlaylistsPager extends PlaylistPager {
    constructor(url, offset = 0) {
        const result = PublisherChannelPlaylistsPager.fetchChannelPlaylists(url, offset);
        super(result.playlists, result.hasMore);
        this.url = url;
        this.offset = offset + 20;  // Increment offset for next page
    }

    static fetchChannelPlaylists(url, offset) {
        const match = url.match(REGEX_PUBLISHER_CHANNEL_URL);
        if (!match) {
            return { playlists: [], hasMore: false };
        }

        const countryCode = match[1];
        const channelId = match[3];

        const apiUrl = API_GET_PUBLISHER_CHANNEL_PODCASTS_URL_TEMPLATE
            .replace('{country}', countryCode)
            .replace('{channel-id}', channelId)
            .replace('{offset}', offset);

        const result = makeGetRequest(apiUrl, { throwOnError: false });
        if (!result) {
            return { playlists: [], hasMore: false };
        }

        const podcasts = result.data || [];

        // Convert each podcast to a PlatformPlaylist object
        const playlists = podcasts.map(podcast => {
            const attributes = podcast.attributes;

            return new PlatformPlaylist({
                id: new PlatformID(PLATFORM, podcast.id, config.id),
                name: attributes.name,
                author: new PlatformAuthorLink(
                    new PlatformID(PLATFORM, podcast.id, config.id),
                    attributes.name,  // Use podcast name as the author name
                    attributes.url,
                    getArtworkUrl(attributes.artwork.url)
                ),
                thumbnail: getArtworkUrl(attributes.artwork.url),
                videoCount: attributes.trackCount || -1,
                url: attributes.url
            });
        });

        return { playlists, hasMore: result.next !== undefined };
    }

    nextPage() {
        const result = PublisherChannelPlaylistsPager.fetchChannelPlaylists(this.url, this.offset);
        this.results = result.playlists;
        this.hasMore = result.hasMore;
        this.offset += 20;  // Increment offset for next page
        return this;
    }
}

class PodcastEpisodesPlaylistPager extends PlaylistPager {
    constructor(url, offset = 0) {
        const result = PodcastEpisodesPlaylistPager.fetchPodcastPlaylist(url, offset);
        super(result.playlists, result.hasMore);
        this.url = url;
        this.offset = offset + 20;  // Increment for next page
        this.id = result.id;
        this.countryCode = result.countryCode;
        this.podcastData = result.podcastData;
    }

    static fetchPodcastPlaylist(url, offset = 0) {
        const match = url.match(REGEX_CHANNEL_URL);
        if (!match) {
            return { playlists: [], hasMore: false };
        }

        const podcastId = match[1];
        const countryCode = extractCountryCode(url) || 'us';
        
        // First, get the podcast metadata
        let podcastData = null;
        if (state.channel[podcastId]) {
            podcastData = state.channel[podcastId];
        } else {
            // If not in cache, fetch the podcast data
            podcastData = source.getChannel(url);
        }
        
        // Create a single playlist from this podcast
        const playlist = new PlatformPlaylist({
            id: new PlatformID(PLATFORM, podcastId, config.id),
            name: podcastData.name,
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, podcastId, config.id),
                podcastData.name,
                podcastData.url,
                podcastData.thumbnail
            ),
            thumbnail: podcastData.thumbnail,
            videoCount: -1, // Unknown count
            url: url
        });
        
        return { 
            playlists: [playlist], 
            hasMore: false,   // No pagination for podcast itself
            id: podcastId,
            countryCode: countryCode,
            podcastData: podcastData
        };
    }

    nextPage() {
        // We only return a single playlist for a podcast, so no more pages
        this.hasMore = false;
        return this;
    }
}

class ApplePublisherChannelEpisodesPager extends ContentPager {
    constructor(url) {
        const match = url.match(REGEX_PUBLISHER_CHANNEL_URL);
        if (!match) {
            super([], false);
            return;
        }
        
        const countryCode = match[1] || COUNTRY_CODES[_settings.countryIndex] || 'us';
        const channelId = match[3];
        
        super(fetchPublisherChannelEpisodesPage(channelId, 0, countryCode), true);
        this.channelId = channelId;
        this.countryCode = countryCode;
        this.offset = 20; // Start next page at offset 20
    }

    nextPage() {
        this.results = fetchPublisherChannelEpisodesPage(this.channelId, this.offset, this.countryCode);
        this.hasMore = this.results.length > 0;
        this.offset += 20; // Increment offset for the next page
        return this;
    }
}

function fetchPublisherChannelEpisodesPage(channelId, offset=0, countryCode='us') {
    const apiUrl = API_GET_PUBLISHER_CHANNEL_EPISODES_URL_TEMPLATE
        .replace('{country}', countryCode)
        .replace('{channel-id}', channelId)
        .replace('{offset}', offset);
    
    const episodesData = makeGetRequest(apiUrl, { throwOnError: false });
    if (!episodesData) {
        return [];
    }
    return (episodesData.data || [])
        .map(episode => podcastToPlatformVideo(episode))
        .filter(Boolean);
}

/**
 * Makes an API request to the specified URL with automatic retries and error handling
 * 
 * @param {string} url - The URL to make the request to
 * @param {Object} options - Configuration options
 * @param {boolean} [options.useAuth=false] - Whether to use authentication for the request
 * @param {boolean} [options.parseResponse=true] - Whether to parse the response as JSON
 * @param {number} [options.maxRetries=3] - Maximum number of retry attempts
 * @param {Object} [options.customHeaders={}] - Additional headers to include in the request
 * @param {boolean} [options.throwOnError=true] - Whether to throw an exception on error
 * @returns {Object|string|null} - Parsed JSON object, response body string, or null on error if not throwing
 * @throws {ScriptException} - If the request fails after all retry attempts and throwOnError is true
 */
function makeGetRequest(url, options = {}) {
	const {
		useAuth = false,
		parseResponse = true,
		maxRetries = 3,
		customHeaders = {},
		throwOnError = true
	} = options;

	let remainingAttempts = maxRetries + 1; // +1 for the initial attempt
	let lastError;
	
	while (remainingAttempts > 0) {
		try {
			// Combine default headers from state with any custom headers
			const headers = {
				...state.headers,
				...customHeaders
			};
			
			const resp = http.GET(url, headers, useAuth);
			
			// Handle non-200 responses
			if (!resp.isOk) {
				const errorMsg = `Request failed with status ${resp.code}: ${url}`;
				if (throwOnError) {
					throw new ScriptException(errorMsg);
				} else {
					log(errorMsg);
					return parseResponse ? null : resp.body;
				}
			}
			
			// Parse response if needed
			if (parseResponse) {
				try {
					const json = JSON.parse(resp.body);
					
					// Check for API error responses that might be in a 200 response
					if (json.errors) {
						const errorMsg = `API returned error: ${JSON.stringify(json.errors)}`;
						if (throwOnError) {
							throw new ScriptException(errorMsg);
						} else {
							log(errorMsg);
							return null;
						}
					}
					
					return json;
				} catch (parseError) {
					const errorMsg = `Failed to parse response as JSON: ${parseError.message}`;
					if (throwOnError) {
						throw new ScriptException(errorMsg);
					} else {
						log(errorMsg);
						return null;
					}
				}
			}
			
			return resp.body;
		} catch (error) {
			lastError = error;
			remainingAttempts--;
			
			if (remainingAttempts > 0) {
				// Log retry attempt but continue
				log(`Request to ${url} failed, retrying... (${maxRetries - remainingAttempts + 1}/${maxRetries})`);
			} else {
				// All retry attempts have failed
				log(`Request failed after ${maxRetries + 1} attempts: ${url}`);
				if (throwOnError) {
					throw lastError;
				} else {
					return parseResponse ? null : null;
				}
			}
		}
	}
}

log("LOADED");