const morgan = require('morgan');
const fs = require('fs');
const rfs = require('rotating-file-stream');

morgan.token('api-token', function (req) {
    if(req.token) {
        return req.token._id + "_" + req.token.name.replace(/[^a-z0-9]/gi, '');
    }
});

const logstream_api = rfs('access.log', {
    interval: '1d',
    path: '/var/log/instances-api'
});

module.exports.api = morgan(':remote-addr - :api-token [:date[clf]] ":method :url HTTP/:http-version" :response-time :status :res[content-length] ":referrer" ":user-agent"', {stream: logstream_api});