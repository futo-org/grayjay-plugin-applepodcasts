const PLATFORM = "Apple Podcasts";

const REGEX_CONTENT_URL = /https:\/\/podcasts\.apple\.com\/[a-zA-Z]*\/podcast\/.*?\/id([0-9]*)\?i=([0-9]*).*?/s
const REGEX_CHANNEL_URL = /https:\/\/podcasts\.apple\.com\/[a-zA-Z]*\/podcast\/.*?\/id([0-9]*)/s
const REGEX_CHANNEL_SHOW = /<script id=schema:show type="application\/ld\+json">(.*?)<\/script>/s
const REGEX_CHANNEL_TOKENS = /<meta name="web-experience-app\/config\/environment" content="(.*?)"/s
const REGEX_EPISODE = /<script name="schema:podcast-episode" type="application\/ld\+json">(.*?)<\/script>/s
const REGEX_IMAGE = /<meta property="og:image" content="(.*?)">/s
const REGEX_WEPICTURE = /class="we-artwork.*?".*?>.*?<source srcset="(.*?) .*?>/s
const REGEX_CANONICAL_URL = /<link rel="canonical" href="(https:\/\/podcasts.apple.com\/[a-zA-Z]*\/podcast\/.*?)">/s
const REGEX_SHOEBOX_PODCAST = /<script type="fastboot\/shoebox" id="shoebox-media-api-cache-amp-podcasts">(.*?)<\/script>/s

const URL_CHANNEL = "https://podcasts.apple.com/us/podcast/the-joe-rogan-experience/id";

var config = {};

//Source Methods
source.enable = function(conf, settings, savedState){
	config = conf ?? {};
}
source.getHome = function() {
	return new ContentPager([], false);
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
	return new ContentPager([], false);
	const url = `https://itunes.apple.com/search?media=podcast&term=${query}`
	const resp = http.GET(url, {});
	if(!resp.isOk)
		throw new ScriptException("Failed to get search results [" + resp.code + "]");
	const result = JSON.parse(resp.body);
	const results = result.results.map(x=>(new PlatformVideo({
		id: new PlatformID(PLATFORM, x.trackid + "", config?.id),
		name: x.trackName,
		thumbnails: new Thumbnails(new Thumbnail(x.artworkUrl100, 0)),
		author: new PlatformAuthorLink(new PlatformID(PLATFORM, x.artistId, config.id, undefined), x.artistName, x.collectionViewUrl, x.artworkUrl100 ?? ""),
		uploadDate: parseInt(new Date(x.releaseDate).getTime() / 1000),
		duration: x.trackTimeMillis,
		viewCount: -1,
		url: x.trackViewUrl,
		isLive: false
	})));

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
	const url = `https://itunes.apple.com/search?media=podcast&term=${query}`
	const resp = http.GET(url, {});
	if(!resp.isOk)
		throw new ScriptException("Failed to get search results [" + resp.code + "]");
	const result = JSON.parse(resp.body);
	const results = result.results.map(x=>new PlatformAuthorLink(new PlatformID(PLATFORM, "" + x.artistId, config.id, undefined), x.artistName, x.collectionViewUrl, x.artworkUrl100 ?? ""));

	return new ChannelPager(results, false);
};



//Channel
source.isChannelUrl = function(url) {
	return REGEX_CHANNEL_URL.test(url);
};
source.getChannel = function(url) {
	const matchUrl = url.match(REGEX_CHANNEL_URL);
	const resp = http.GET(url, {});
	if(!resp.isOk)
		throw new ScriptException("Failed to get channel [" + resp.code + "]");

	const showMatch = resp.body.match(REGEX_CHANNEL_SHOW);
	if(!showMatch || showMatch.length != 2) {
		console.log("No show data", resp.body);
		throw new ScriptException("Could not find show data");
	}
	const showData = JSON.parse(showMatch[1]);

	const thumbnail = matchFirstOrDefault(resp.body, REGEX_WEPICTURE);
	const banner = matchFirstOrDefault(resp.body, REGEX_IMAGE);

	return new PlatformChannel({
		id: new PlatformID(PLATFORM, matchUrl[1], config.id, undefined),
		name: showData.name,
		thumbnail: thumbnail,
		banner: banner,
		subscribers: -1,
		description: showData.description,
		url: removeQuery(url),
		urlAlternatives: [removeQuery(url)],
		links: {}
	});
};

source.getChannelContents = function(url) {
	const id = removeRemainingQuery(url.match(REGEX_CHANNEL_URL)[1]);
	return new AppleChannelContentPager(id);
};
class AppleChannelContentPager extends ContentPager {
	constructor(id) {
		super(fetchEpisodesPage(id, 0), true);
		this.offset = this.results.length;
		this.id = id;
	}

	nextPage() {
		this.results = fetchEpisodesPage(this.id, this.offset);
		this.hasMore = this.results.length > 0;
		return this;
	}
}
function fetchEpisodesPage(id, offset) {
	const mediaToken = getMediaToken(URL_CHANNEL + id);
	const urlEpisodes = `https://amp-api.podcasts.apple.com/v1/catalog/us/podcasts/${id}/episodes?l=en-US&offset=` + (offset ?? 0);
	const resp = http.GET(urlEpisodes, {"Authorization": "Bearer " + mediaToken, "Origin": "https://podcasts.apple.com"});
	if(!resp.isOk)
		throw new ScriptException("Failed to get channel episodes [" + resp.code + "]");

		//"https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/e2/7b/f1/e27bf1c3-82a7-d2a2-4de9-4ffe58918ac7/mza_6121424548892044766.jpg/{w}x{h}bb.{f}"
	const episodes = JSON.parse(resp.body);
	console.log("Episodes", episodes);
	return episodes.data.map(x=>(new PlatformVideo({
		id: new PlatformID(PLATFORM, "" + x.id, config?.id),
		name: x.attributes.name,
		thumbnails: new Thumbnails([new Thumbnail(getArtworkUrl(x.attributes.artwork.url, 0))]),
		author: new PlatformAuthorLink(new PlatformID(PLATFORM, "" + id, config.id, undefined), x.attributes.artistName, URL_CHANNEL + id, "" ?? ""),
		uploadDate: parseInt(new Date(x.attributes.releaseDateTime).getTime() / 1000),
		duration: parseInt(x.attributes.durationInMilliseconds / 1000),
		viewCount: -1,
		url: x.attributes.url,
		isLive: false,
		description: x.attributes.description.standard,
		video: new UnMuxVideoSourceDescriptor([], [
			new AudioUrlSource({
				name: "Podcast",
				container: "audio/mpeg",
				bitrate: 0,
				url: x.attributes.assetUrl,
				duration: parseInt(x.attributes.durationInMilliseconds / 1000),
				codec: "",
				language: Language.UNKNOWN,
			})
		])
	})));
}



//Video
source.isContentDetailsUrl = function(url) {
	return REGEX_CONTENT_URL.test(url);
};
source.getContentDetails = function(url) {
	const matchUrl = url.match(REGEX_CONTENT_URL);

	const resp = http.GET(url, {});
	if(!resp.isOk)
		throw new ScriptException("Failed to get content details [" + resp.code + "]");
	
	const episodeDictMatch = resp.body.match(REGEX_SHOEBOX_PODCAST);
	if(!episodeDictMatch || episodeDictMatch.length != 2) {
		console.log("No episode data", resp.body);
		throw new ScriptException("Could not find episode data");
	}
	const episodeDictData = JSON.parse(episodeDictMatch[1]);
	const keys = Object.keys(episodeDictData);
	const episodeKey = keys.find(x=>/v1.catalog.us.podcast-episodes/.test(x));
	if(!episodeKey) {
		console.log("Episode keys:", keys);
		throw new ScriptException("No episode key found");
	}
	const episodeData = JSON.parse(episodeDictData[episodeKey]).d[0];
	const podcastData = episodeData.relationships.podcast.data[0];

	console.log("Episode Data", episodeData);

	const imageUrl = matchFirstOrDefault(resp.body, REGEX_WEPICTURE, "");
	const podcastUrl = url.substring(0, url.indexOf("?i="));
	

	return new PlatformVideoDetails({
		id: new PlatformID(PLATFORM, matchUrl[2], config?.id),
		name: episodeData.attributes.name,
		thumbnails: new Thumbnails([new Thumbnail(getArtworkUrl(episodeData.attributes.artwork.url), 0)]),
		author: new PlatformAuthorLink(new PlatformID(PLATFORM, matchUrl[1], config.id, undefined), podcastData.attributes.name, podcastUrl, getArtworkUrl(podcastData.attributes.artwork.url)),
		uploadDate: parseInt(new Date(episodeData.attributes.releaseDateTime).getTime() / 1000),
		duration: parseInt(episodeData.attributes.durationInMilliseconds / 1000),
		viewCount: -1,
		url: episodeData.attributes.url,
		isLive: false,
		description: episodeData.attributes.description.standard,
		video: new UnMuxVideoSourceDescriptor([], [
			new AudioUrlSource({
				name: "Podcast",
				container: "audio/mpeg",
				bitrate: 0,
				url: episodeData.attributes.assetUrl,
				duration: parseInt(episodeData.attributes.durationInMilliseconds / 1000),
				codec: "",
				language: Language.UNKNOWN,
			})
		])
	});
};

function getArtworkUrl(url) {
	return url.replace("{w}", "268").replace("{h}", "268").replace("{f}", "png");
}

let _mediaToken = undefined;
function getMediaTokenFromBody(body) {
	if(_mediaToken)
		return _mediaToken;
	const match = body.match(REGEX_CHANNEL_TOKENS);
	if(match && match.length > 0)
	{
		const matchJson = decodeURIComponent(match[1]);
		const hydration = JSON.parse(matchJson);
		_mediaToken = hydration?.MEDIA_API?.token;
		if(_mediaToken)
			return _mediaToken;
	}
	throw new ScriptException("Could not find token");
}
function getMediaToken(url) {
	if(_mediaToken)
		return _mediaToken;
	const resp = http.GET(url, {});
	if(!resp.isOk)
		throw new ScriptException("Failed to get media token [" + resp.code + "]");
	return getMediaTokenFromBody(resp.body);
}

function PTTimeToSeconds(str) {
	if(!str)
		return 0;
	str = str.trim();
	if(str.indexOf("PT") != 0)
		return 0;
	str = str.substring(0);
	
	const parts = [..."PT3H6M".matchAll(/([0-9])+?([A-Z])/g)];
	let seconds = 0;
	for(let part of parts) {
		const time = parseInt(parts[1]);
		switch(part[2]) {
			case "H":
				seconds += time * 60 * 60;
				break;
			case "M":
				seconds += time * 60;
				break;
			case "S":
				seconds += time;
				break;
		}
	}
	return seconds;
}

function matchFirstOrDefault(data, regex, def) {
	const match = data.match(regex);
	if(match && match.length > 0)
		return match[1];
	return def;
}

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
function removeQuery(query) {
	const indexQuestion = query.indexOf("?");
	if(indexQuestion >= 0)
		return query.substring(0, indexQuestion);
	return query;
}


console.log("LOADED");