const User = require('./User');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const Sequelize = require('sequelize');
const EmailService = require('../email/EmailService');
const sequelize = require('../config/database');
const EmailException = require('../email/EmailException');
const InvalidTokenException = require('./InvalidTokenException');
const UserNotFoundException = require('./UserNotFoundException');
const { randomString } = require('../shared/generator');

const save = async (body) => {
  const { username, password, email } = body;
  const hash = await bcrypt.hash(password, 10);
  const user = {
    username,
    email,
    password: hash,
    activationToken: randomString(16)
  };

  const transaction = await sequelize.transaction();
  await User.create(user, { transaction });

  try {
    await EmailService.sendAccountActivation(email, user.activationToken);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw new EmailException();
  }
};

const findByEmail = async (email) => {
  const user = await User.findOne({ where: { email: email } });
  return user;
};

const activate = async (token) => {
  const user = await User.findOne({ where: { activationToken: token } });

  if (!user) {
    throw new InvalidTokenException();
  }
  user.inactive = false;
  user.activationToken = null;
  await user.save();
};

const getUsers = async (page, size, autheticatedUser) => {
  const usersWithCount = await User.findAndCountAll({
    where: {
      inactive: false,
      id: { [Sequelize.Op.not]: autheticatedUser ? autheticatedUser.id : 0 }
    },
    attributes: ['id', 'username', 'email'],
    limit: size,
    offset: page * size
  });
  return {
    content: usersWithCount.rows,
    page,
    size,
    totalPages: Math.ceil(usersWithCount.count / size)
  };
};

const getUser = async (id) => {
  const user = await User.findOne({
    where: { id: id, inactive: false },
    attributes: ['id', 'username', 'email']
  });

  if (!user) throw new UserNotFoundException();

  return user;
};

const updateUser = async (id, updateBody) => {
  const user = await User.findOne({ where: { id: id } });
  user.username = updateBody.username;
  await user.save();
};

const deleteUser = async (id) => {
  await User.destroy({ where: { id: id } });
};
module.exports = {
  save,
  findByEmail,
  activate,
  getUsers,
  getUser,
  updateUser,
  deleteUser
};
