'use strict';

const Sequelize = require('sequelize');
const config = require('../config');

const sequelize = new Sequelize({
    host: config.postgresql.host,
    port: config.postgresql.port,
    database: config.postgresql.database,
    username: config.postgresql.username,
    password: config.postgresql.password,

    dialect: 'postgres',

    operatorsAliases: false,

    logging: process.env.NODE_ENV === 'development' ? console.log : false
});

module.exports = sequelize;