const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');

// Configuration for the channels you want to include
const config = {
    countries: ['BE'],
    languages: ['nld'],
    excludeCategories: ['music', 'general', 'Religious', 'news', 'XXX'],
};

// Addon Manifest
const addon = new addonBuilder({
    id: 'org.iptvaddon',
    name: 'IPTV Addon',
    version: '0.0.1',
    description: 'Watch live TV from selected countries and languages',
    resources: ['catalog', 'meta', 'stream'],
    types: ['tv'],
    catalogs: [{
        type: 'tv',
        id: 'iptv-channels',
        name: 'IPTV',
    }],
    idPrefixes: ['iptv-'],
});

// Convert channel to Stremio accepted Meta object
const toMeta = (channel, guideDetails) => ({
    id: `iptv-${channel.id}`,
    name: channel.name,
    type: 'tv',
    genres: channel.categories || null,
    poster: guideDetails ? guideDetails.currentShowImage : channel.logo,
    posterShape: 'square',
    background: channel.logo || null,
    logo: channel.logo || null,
    description: guideDetails ? `Now Playing: ${guideDetails.nowPlaying}\nNext: ${guideDetails.next}` : null,
});

// Function to extract relevant details from guide information (replace with actual logic)
const extractGuideDetails = (guide) => {
    console.log(guide);
    // Extract relevant details from guide information (update as needed)
    return {
        nowPlaying: 'Example Now Playing',
        next: 'Example Next Show',
        currentShowImage: 'https://example.com/show-image.png',
    };
};

// Fetch Channels based on the configuration
const getChannels = async () => {
    const response = await axios.get('https://iptv-org.github.io/api/channels.json');
    return response.data.filter((channel) =>
        config.countries.includes(channel.country) &&
        config.languages.some(lang => channel.languages.includes(lang)) &&
        !config.excludeCategories.some(cat => channel.categories.includes(cat))
    ).map((channel) => toMeta(channel, null)); // Pass null for guideDetails
};

// Catalog Handler
addon.defineCatalogHandler(async (args) => {
    if (args.type === 'tv' && args.id === 'iptv-channels') {
        const channels = await getChannels();
        console.log('channels: ', channels);
        return { metas: channels };
    }
    return { metas: [] };
});

// Fetch Guide Info for the Channel
const getGuideInfo = async (channelID) => {
    const response = await axios.get('https://iptv-org.github.io/api/guides.json');
    return response.data.find((guide) => guide.channel === channelID);
};

// Meta Handler
addon.defineMetaHandler(async (args) => {
    if (args.type === 'tv' && args.id.startsWith('iptv-')) {
        const channelID = args.id.split('iptv-')[1];
        const response = await axios.get('https://iptv-org.github.io/api/channels.json');
        const channel = response.data.find((channel) => channel.id === channelID);
        if (channel) {
            // Fetch guide information
            const guideInfo = await getGuideInfo(channelID);
            // Extract relevant details from guide information
            const details = extractGuideDetails(guideInfo);
            // Modify the meta object based on the guide information
            const meta = toMeta(channel, details);
            return { meta };
        }
    }
    return { meta: {} };
});

// Stream Handler
addon.defineStreamHandler(async (args) => {
    if (args.type === 'tv' && args.id.startsWith('iptv-')) {
        const channelID = args.id.split('iptv-')[1];
        const streamsResponse = await axios.get('https://iptv-org.github.io/api/streams.json');
        const stream = streamsResponse.data.find((stream) => stream.channel === channelID);
        console.log('channelID: ', channelID);

        if (stream) {
            console.log('stream.channel: ', stream.channel);
            console.log('stream: ', stream);
            return {
                streams: [
                    {
                        url: stream.url,
                        title: 'Live Stream',
                    },
                ],
            };
        } else {
            console.log('No matching stream found for channelID:', channelID);
        }
    }
    return { streams: [] };
});

// Serve Add-on on Port 3000
serveHTTP(addon.getInterface(), { port: 3000 });
console.log('Add-on is running at http://127.0.0.1:3000/manifest.json');
