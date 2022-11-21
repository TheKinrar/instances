'use strict';

const Sequelize = require('sequelize');
const sequelize = require('.');

const Instance = require('./instance.js');
const Probe = require('./probe.js');

const Ping = sequelize.define('ping', {
    instance: {
        type: Sequelize.DataTypes.BIGINT,

        references: {
            model: Instance,
            key: 'id'
        }
    },

    success: Sequelize.DataTypes.BOOLEAN,
    error: Sequelize.DataTypes.TEXT,

    average: Sequelize.DataTypes.FLOAT,
    jitter: Sequelize.DataTypes.FLOAT
}, {
    updatedAt: false
});

Ping.belongsTo(Probe);

module.exports = Ping;
