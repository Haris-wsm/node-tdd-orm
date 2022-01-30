const sequelize = require('../src/config/database');
const Token = require('../src/auth/Token');

const TokenService = require('../src/auth/TokenService');

beforeEach(async () => {
  return await Token.destroy({ truncate: true });
});

describe('Scheduled Token Cleanup', () => {
  it('clears the expired token with scheduled task', async () => {
    jest.useFakeTimers();
    const token = 'test-token';

    const eigthDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

    await Token.create({ token: token, lastUseAt: eigthDaysAgo });

    TokenService.scheduleCleanup();
    jest.advanceTimersByTime(60 * 60 * 1000 + 5000);
    const tokenInDb = await Token.findOne({ where: { token: token } });
    expect(tokenInDb).toBeNull();
  });
});
