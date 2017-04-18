const express = require('express');
const flash = require('express-flash');
const bodyParser = require('body-parser');
const nunjucks = require('nunjucks');
const fs = require('fs');
const Session = require('express-session');
const Languages = require('languages');
const MongoStore = require('connect-mongo')(Session);
global.Request = require('request').defaults({
    headers: {
        'User-Agent': 'MastodonInstances/1.0.0 (https://instances.mastodon.xyz)'
    }
});

global.config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
global.ProhibitedContent = JSON.parse(fs.readFileSync('prohibitedContent.json', 'utf8'));
ProhibitedContent.array = Object.keys(ProhibitedContent).map((code) => {
	return {
		code,
		name: ProhibitedContent[code]
	};
});

global.Mailgun = require('mailgun-js')({
    apiKey: config.mailgun.key,
    domain: config.mailgun.domain
});

global.DB = require('monk')('localhost/mastodon-instances');
const app = express();

app.locals.ProhibitedContent = ProhibitedContent;
app.locals.Languages = Languages;

app.enable('trust proxy');

const session = Session({
	cookie: {
		httpOnly: true,
		maxAge: 60 * 60 * 1000,
		secure: true
	},
	proxy: true,
	secret: config.session_secret,
	resave: false,
	saveUninitialized: false,
	store: new MongoStore({
		url: 'mongodb://localhost/mastodon-instances'
	})
});
app.use(session);
app.use(flash());

nunjucks.configure('views', {
    express: app
});
app.set('view engine', 'njk');

app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(express.static('public'));
app.use(require('./controllers'));

app.listen(8737);