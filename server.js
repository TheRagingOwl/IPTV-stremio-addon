
const express = require('express');
const axios = require('axios');
const m3u8 = require('m3u8-parser');
const app = express();
const cors = require('cors');
app.use(cors());
const port = process.env.PORT || 3000;

const manifest = {
    id: 'iptv.stremio.addon',
    version: '0.0.1',
    name: 'IPTV-stremio-addon',
    description: 'Watch IPTV channels',
    resources: ['catalog', 'stream'],
    types: ['channel'],
    idPrefixes: ['IPTV_'],
    catalogs: [
        {
            id: 'IPTV_catalog',
            type: 'channel',
            name: 'IPTV Channels',
            extra: [{ name: 'search' }]
        }
    ]
};

app.get('/manifest.json', (req, res) => {
    res.json(manifest);
});

app.get('/catalog/channel/IPTV_catalog.json', async (req, res) => {
    try {
        const { data: playlist } = await axios.get('https://iptv-org.github.io/iptv/index.m3u');

        const lines = playlist.split('\n');
        const channels = [];

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#EXTINF:')) {
                const titleMatch = lines[i].match(/,(.*)/);
                const logoMatch = lines[i].match(/tvg-logo="(.*?)"/);
                const url = lines[i + 1].trim();

                if (titleMatch && url) {
                    channels.push({
                        id: `IPTV_${channels.length}`,
                        type: 'channel',
                        name: titleMatch[1],
                        poster: logoMatch ? logoMatch[1] : undefined,
                        streams: [{ url: url }]
                    });
                }
            }
        }

        res.json({ metas: channels });
    } catch (error) {
        console.error('Error fetching playlist:', error.message);
        res.status(500).send('An error occurred while fetching the channels.');
    }
});

app.get('/stream/channel/IPTV_:id.json', async (req, res) => {
    try {
        const { data: playlist } = await axios.get('https://iptv-org.github.io/iptv/index.nsfw.m3u');
        const parser = new m3u8.Parser();
        parser.push(playlist);
        parser.end();

        const channelId = parseInt(req.params.id.replace('IPTV_', ''), 10);
        const channel = parser.manifest.items[channelId];

        if (channel) {
            res.json({ streams: [{ url: channel.uri }] });
        } else {
            res.status(404).send('Channel not found.');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while fetching the streams.');
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
