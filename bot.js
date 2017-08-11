const Mastodon = require('mastodon-api');
const config = require('./config.json');

const bot = new Mastodon({
    access_token: config.bot.access_token,
    api_url: 'https://mastodon.xyz/api/v1/'
});

module.exports = bot;