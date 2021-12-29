const User = require('./User');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const EmailService = require('../email/EmailService');

const generateToken = (length) => {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
};
const save = async (body) => {
  const { username, password, email } = body;
  const hash = await bcrypt.hash(password, 10);
  const user = {
    username,
    email,
    password: hash,
    activationToken: generateToken(16)
  };
  await User.create(user);

  await EmailService.sendAccountActivation(email, user.activationToken);
};

const findByEmail = async (email) => {
  const user = await User.findOne({ where: { email: email } });
  return user;
};

module.exports = { save, findByEmail };
