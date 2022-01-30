const Sequelize = require('sequelize');
const sequelize = require('../config/database');
// require('pg').defaults.parseInt8 = true;
const Model = Sequelize.Model;
const FileAttachment = require('../file/FileAttachment');

class Hoax extends Model {}

Hoax.init(
  {
    content: {
      type: Sequelize.STRING
    },
    timestamp: {
      type: Sequelize.BIGINT
    }
  },
  { sequelize, modelName: 'hoax', timestamps: false }
);

Hoax.hasOne(FileAttachment, { foreignKey: 'hoaxId', onDelete: 'cascade' });
FileAttachment.belongsTo(Hoax);

module.exports = Hoax;
