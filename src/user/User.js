const Sequelize = require('sequelize');
const sequelize = require('../config/database');

const Modal = Sequelize.Model;
class User extends Modal {}

User.init(
  {
    username: { type: Sequelize.STRING },
    email: { type: Sequelize.STRING },
    password: { type: Sequelize.STRING },
    inactive: { type: Sequelize.BOOLEAN, defaultValue: true },
    activationToken: { type: Sequelize.STRING }
  },
  { sequelize, modelName: 'user' }
);

module.exports = User;
