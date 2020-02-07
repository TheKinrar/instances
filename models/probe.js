'use strict';

const Sequelize = require('sequelize');
const sequelize = require('.');

const Probe = sequelize.define('probe', {
    name: {
        type: Sequelize.DataTypes.TEXT,
        allowNull: false,
        unique: true
    },

    country: {
        type: Sequelize.DataTypes.TEXT,
        allowNull: false
    },

    city: {
        type: Sequelize.DataTypes.TEXT,
        allowNull: false
    },
});

module.exports = Probe;
