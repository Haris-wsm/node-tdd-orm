const development = require('./development');
const test = require('./test');
const production = require('./production');
const staging = require('./staging');

module.exports = {
  development,
  production,
  test,
  staging
};
