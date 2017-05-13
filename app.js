const express = require('express');
const flash = require('express-flash');
const bodyParser = require('body-parser');
const nunjucks = require('nunjucks');
const Influx = require('influx');
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

global.influx = new Influx.InfluxDB({
    host: 'localhost',
    database: 'mastodon_instances',
    schema: [
        {
            measurement: 'instance_stats',
            fields: {
                uptime: Influx.FieldType.FLOAT,
                https_score: Influx.FieldType.INTEGER,
                obs_score: Influx.FieldType.INTEGER,
                https_rank: Influx.FieldType.STRING,
                obs_rank: Influx.FieldType.STRING,
                ipv6: Influx.FieldType.BOOLEAN,
                openRegistrations: Influx.FieldType.BOOLEAN,
                users: Influx.FieldType.INTEGER,
                statuses: Influx.FieldType.INTEGER,
                connections: Influx.FieldType.INTEGER
            },
            tags: [
                'instance'
            ]
        }, {
            measurement: 'network_stats',
            fields: {
                average_uptime: Influx.FieldType.FLOAT,
                median_uptime: Influx.FieldType.FLOAT,
                average_https_score: Influx.FieldType.INTEGER,
                median_https_score: Influx.FieldType.INTEGER,
                average_obs_score: Influx.FieldType.INTEGER,
                median_obs_score: Influx.FieldType.INTEGER,
                ipv6_absolute: Influx.FieldType.INTEGER,
                ipv6_relative: Influx.FieldType.FLOAT,
                openRegistrations_absolute: Influx.FieldType.INTEGER,
                openRegistrations_relative: Influx.FieldType.FLOAT,
                users: Influx.FieldType.INTEGER,
                statuses: Influx.FieldType.INTEGER,
                connections: Influx.FieldType.INTEGER
            },
            tags: []
        }
    ]
});

/*const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/mastodon-instances');*/

global.DB = require('monk')('localhost/mastodon-instances');
const app = express();

app.locals.ProhibitedContent = ProhibitedContent;
app.locals.Languages = Languages;

updateNetworkStats();
setInterval(updateNetworkStats, 5 * 60 * 1000);

function updateNetworkStats() {
	DB.get('instances').find({
        "upchecks": {
            "$gt": 0
        },
        "blacklisted": {
            "$ne": true
        },
        "dead": {
            "$ne": true
        }
    }).then((instances) => {
		let users = 0,
			statuses = 0,
			connections = 0;

		instances.forEach((instance) => {
            if(instance.users)
                users += instance.users;

            if(instance.statuses)
                statuses += instance.statuses;

            if(instance.connections)
                connections += instance.connections;
		});

		global.networkStats = app.locals.networkStats = {
			users,
			statuses,
            connections
		};
	}).catch(console.error);
}

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