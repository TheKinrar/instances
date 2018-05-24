'use strict';

const Sequelize = require('sequelize');
const sequelize = require('.');

const Software = sequelize.define('software', {
    name: {
        type: Sequelize.DataTypes.TEXT,
        allowNull: false,
        unique: true
    },

    base: {
        type: Sequelize.DataTypes.INTEGER,

        references: {
            model: 'Software',
            key: 'id'
        }
    }
}, {
    createdAt: false,
    updatedAt: false
});

module.exports = Software;