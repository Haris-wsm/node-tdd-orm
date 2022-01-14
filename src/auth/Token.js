const Sequelize = require('sequelize');
const sequelize = require('../config/database');

const Modal = Sequelize.Model;
class Token extends Modal {}

Token.init(
  {
    token: Sequelize.STRING,
    lastUseAt: {
      type: Sequelize.DATE
    }
  },
  { sequelize, modelName: 'token', timestamps: false }
);

module.exports = Token;
