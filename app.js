const express = require('express');
const bodyParser = require('body-parser');
const nunjucks = require('nunjucks');

global.DB = require('monk')('localhost/mastodon-instances');
const app = express();

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