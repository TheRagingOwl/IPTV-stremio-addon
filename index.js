const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');

// Configuration for the channels you want to include
const config = {
    countries: ['BE',],
    languages: ['nld',],
    excludeCategories: ['music', 'general', 'Religious', 'news', 'XXX'],
};

const addon = new addonBuilder({
    id: 'org.iptvaddon',
    name: 'IPTV Addon',
    version: '0.0.1',
    description: 'Watch live tv from selected countries and languages',
    resources: ['catalog', 'meta', 'stream'],
    types: ['channel'],
    catalogs: [
        {
            type: 'channel',
            id: 'SelectedCatalog',
            name: 'Selected Channels',
        },
    ],
    idPrefixes: ['iptv-'],
});

// Convert channel to Stremio accepted Meta object
const toMeta = (channel) => ({
    id: `iptv-${channel.id}`,
    name: channel.name,
    type: 'channel',
    poster: channel.logo || null,
});

// Fetch Channels based on the configuration
const getChannels = async () => {
    const response = await axios.get('https://iptv-org.github.io/api/channels.json');
    return response.data.filter((channel) =>
        config.countries.includes(channel.country) &&
        config.languages.some(lang => channel.languages.includes(lang)) &&
        !config.excludeCategories.some(cat => channel.categories.includes(cat))
    ).map(toMeta);
};

// Catalog Handler
addon.defineCatalogHandler(async (args) => {
    if (args.type === 'channel' && args.id === 'SelectedCatalog') {
        const channels = await getChannels();
        return { metas: channels };
    }
    return { metas: [] };
});

// Meta Handler
addon.defineMetaHandler(async (args) => {
    if (args.type === 'channel' && args.id.startsWith('iptv-')) {
        const channelID = args.id.split('iptv-')[1];
        const response = await axios.get('https://iptv-org.github.io/api/channels.json');
        const channel = response.data.find((channel) => channel.id === channelID);
        if (channel) {
            return { meta: toMeta(channel) };
        }
    }
    return { meta: {} };
});

// Stream Handler
addon.defineStreamHandler(async (args) => {
    if (args.type === 'channel' && args.id.startsWith('iptv-')) {
        const channelID = args.id.split('iptv-')[1];
        const streamsResponse = await axios.get('https://iptv-org.github.io/api/streams.json');
        const stream = streamsResponse.data.find((stream) => stream.channel === channelID);
        if (stream) {
            return {
                streams: [
                    {
                        url: stream.url,
                        title: 'Live Stream',
                    },
                ],
            };
        }
    }
    return { streams: [] };
});

// Serve Add-on on Port 3000
serveHTTP(addon.getInterface(), { port: 3000 });
console.log('Add-on is running at http://127.0.0.1:3000/manifest.json');
