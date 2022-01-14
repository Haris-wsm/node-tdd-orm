const { randomString } = require('../shared/generator');
const Token = require('../auth/Token');
const Sequelize = require('sequelize');
const ONE_WEEK_IN_MILLIS = 7 * 24 * 60 * 60 * 1000;

const createToken = async (user) => {
  const token = randomString(32);

  await Token.create({ token: token, userId: user.id, lastUseAt: new Date() });
  return token;
};

const verify = async (token) => {
  const oneWeekAgo = new Date(Date.now() - ONE_WEEK_IN_MILLIS);
  const tokenInDb = await Token.findOne({
    where: { token: token, lastUseAt: { [Sequelize.Op.gt]: oneWeekAgo } }
  });
  tokenInDb.lastUseAt = new Date();
  await tokenInDb.save();
  const userId = tokenInDb.userId;

  return { id: userId };
};

const deleteToken = async (token) => {
  await Token.destroy({ where: { token: token } });
};

const scheduleCleanup = async () => {
  setInterval(async () => {
    const oneWeekAgo = new Date(Date.now() - ONE_WEEK_IN_MILLIS);

    await Token.destroy({
      where: { lastUseAt: { [Sequelize.Op.lt]: oneWeekAgo } }
    });
  }, 60 * 60 * 1000);
};

module.exports = { createToken, verify, deleteToken, scheduleCleanup };
