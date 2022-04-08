'use strict';

const Sequelize = require('sequelize');
const sequelize = require('.');

const Blacklist = sequelize.define('blacklist', {
    domain: {
        type: Sequelize.DataTypes.TEXT,
        primaryKey: true
    },
}, {
    tableName: 'blacklist',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = Blacklist;
