'use strict';

const Sequelize = require('sequelize');
const sequelize = require('.');

const Instance = require('./instance.js');
const Probe = require('./probe.js');

const Ping = sequelize.define('ping', {
    instance: {
        type: Sequelize.DataTypes.INTEGER,

        references: {
            model: Instance,
            key: 'id'
        }
    },

    probe: {
        type: Sequelize.DataTypes.INTEGER,

        references: {
            model: Probe,
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

module.exports = Ping;
