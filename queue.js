'use strict';

const config = require('./config');
const kue = require('kue');
const Promise = require('bluebird');

Promise.promisifyAll(kue.Job.prototype);

const queue = kue.createQueue({
    prefix: 'kue',
    redis: config.redis
});

module.exports = queue;