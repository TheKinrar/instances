'use strict';

const Sequelize = require('sequelize');
const sequelize = require('.');

const Downtime = sequelize.define('downtime', {
    start: Sequelize.DataTypes.DATE,
    end: Sequelize.DataTypes.DATE,

    instance: {
        type: Sequelize.DataTypes.INTEGER,

        references: {
            model: 'Instance',
            key: 'id'
        }
    }
}, {
    createdAt: false,
    updatedAt: false
});



module.exports = Downtime;