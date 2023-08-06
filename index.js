const express = require('express');
const cors = require('cors');
const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');

const IPTV_CHANNELS_URL = 'https://iptv-org.github.io/api/channels.json';
const IPTV_STREAMS_URL = 'https://iptv-org.github.io/api/streams.json';
const IPTV_GUIDES_URL = 'https://iptv-org.github.io/api/guides.json';
const PORT = process.env.PORT || 3000;

// Configuration for the channels you want to include
let config = {
    includeLanguages: [],
    includeCountries: ['BE'],
    excludeLanguages: ['fra', 'ger'],
    excludeCountries: [],
    excludeCategories: ['legislative', 'music', 'XXX'],
};

const app = express();
app.use(cors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    optionsSuccessStatus: 204
}));
app.use(express.json());

// Serve index.html file from root directory
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Addon Manifest
const addon = new addonBuilder({
    id: 'org.iptv',
    name: 'IPTV Addon',
    version: '0.0.1',
    description: 'Watch live TV from selected countries and languages',
    resources: ['catalog', 'meta', 'stream'],
    types: ['tv'],
    catalogs: [{
        type: 'tv',
        id: 'iptv-channels',
        name: 'IPTV',
        extra: [{ name: 'search' }],
    }],
    idPrefixes: ['iptv-'],
    behaviorHints: { configurable: true, configurationRequired: false },
    logo: "https://dl.strem.io/addon-logo.png",
    icon: "https://dl.strem.io/addon-logo.png",
    background: "https://dl.strem.io/addon-background.jpg",
});

// Endpoint to update configuration
app.post('/update-config', (req, res) => {
    config = req.body;
    res.send('Configuration updated successfully.');
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
    // console.log('guide: ', guide);
    // Extract relevant details from guide information (update as needed)
    return {
        nowPlaying: 'Example Now Playing',
        next: 'Example Next Show',
        currentShowImage: 'https://example.com/show-image.png',
    };
};

// Fetch Channels based on the configuration
const getChannels = async () => {
    try {
        const channelsResponse = await axios.get(IPTV_CHANNELS_URL);
        const streamsResponse = await axios.get(IPTV_STREAMS_URL);

        const filteredChannels = channelsResponse.data.filter((channel) =>
            (config.includeCountries.length === 0 || config.includeCountries.includes(channel.country)) &&
            (config.excludeCountries.length === 0 || !config.excludeCountries.includes(channel.country)) &&
            (config.includeLanguages.length === 0 || channel.languages.some(lang => config.includeLanguages.includes(lang))) &&
            (config.excludeLanguages.length === 0 || !channel.languages.some(lang => config.excludeLanguages.includes(lang))) &&
            !config.excludeCategories.some(cat => channel.categories.includes(cat))
            && streamsResponse.data.some((stream) => stream.channel === channel.id)
        );

        // console.log("Filtered Channels:", filteredChannels.map(channel => channel.name));

        return filteredChannels.map((channel) => toMeta(channel, null));
    } catch (error) {
        console.error('Error fetching channels:', error);
        return [];
    }
};

// Catalog Handler
addon.defineCatalogHandler(async (args) => {
    if (args.type === 'tv' && args.id === 'iptv-channels') {
        const channels = await getChannels();
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
        // console.log('channel: ', channel);
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

        if (stream) {
            // console.log('stream: ', stream);
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
app.get('/manifest.json', (req, res) => {
    const manifest = addon.getInterface();
    console.log(manifest);
    res.setHeader('Content-Type', 'application/json');
    res.json(manifest);
});
serveHTTP(addon.getInterface(), { server: app, path: '/manifest.json', port: PORT });
console.clear();
console.log(`config is at http://localhost:${PORT}/`);

