const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const Token = require('../src/auth/Token');
const sequelize = require('../src/config/database');
const bcrypt = require('bcrypt');
const en = require('../locals/en/translation.json');
const th = require('../locals/th/translation.json');

beforeAll(() => {
  return sequelize.sync();
});

beforeEach(() => {
  return User.destroy({ truncate: { cascade: true } });
});

const activeUser = {
  username: 'user1',
  email: 'user1@mail.com',
  inactive: false,
  password: 'P4ssword'
};
const addUser = async (user = { ...activeUser }) => {
  const hash = await bcrypt.hash(user.password, 10);
  user.password = hash;
  return await User.create(user);
};

const postAuthentication = async (credentail, options = {}) => {
  let agent = request(app).post('/api/1.0/auth');

  if (options.language) {
    agent.set('accept-language', options.language);
  }
  return await agent.send(credentail);
};

const postLogout = (options = {}) => {
  let agent = request(app).post('/api/1.0/logout');

  if (options.token) {
    agent.set('Authorization', `Bearer ${options.token}`);
  }
  return agent.send();
};

describe('Authentication', () => {
  it('returns 200 when credentail are correct', async () => {
    await addUser();
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword'
    });

    expect(response.status).toBe(200);
  });

  it('returns only id username and token when login success', async () => {
    const user = await addUser();
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword'
    });

    expect(response.body.id).toBe(user.id);
    expect(response.body.username).toBe(user.username);
    expect(Object.keys(response.body)).toEqual(['id', 'username', 'token']);
  });

  it('returns 401 when user does not exist', async () => {
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword'
    });
    expect(response.status).toBe(401);
  });

  it('returns proper error body when authentication fails', async () => {
    const nowInMilli = new Date().getTime();
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword'
    });

    const error = response.body;
    expect(error.timestamp).toBeGreaterThan(nowInMilli);
    expect(Object.keys(error)).toEqual(['path', 'timestamp', 'message']);
  });

  it.each`
    language | message
    ${'en'}  | ${en.authentication_failure}
    ${'th'}  | ${th.authentication_failure}
  `(
    'returns $message when authetication fail when language is set to $language',
    async ({ language, message }) => {
      const response = await postAuthentication(
        {
          email: 'user1@mail.com',
          password: 'P4ssword'
        },
        { language }
      );

      const error = response.body;

      expect(error.message).toBe(message);
    }
  );

  it('return 401 when password is wrong', async () => {
    await addUser();
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'p4ssword'
    });

    expect(response.status).toBe(401);
  });

  it('returns 403 when login with inactive an account', async () => {
    await addUser({ ...activeUser, inactive: true });
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword'
    });
    expect(response.status).toBe(403);
  });
  it('returns proper error body when inactive authentication fails', async () => {
    await addUser({ ...activeUser, inactive: true });

    const nowInmilli = new Date().getTime();
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword'
    });

    const error = response.body;
    expect(error.timestamp).toBeGreaterThan(nowInmilli);
    expect(Object.keys(error)).toEqual(['path', 'timestamp', 'message']);
  });

  it.each`
    language | message
    ${'en'}  | ${en.inactive_authentication_failure}
    ${'th'}  | ${th.inactive_authentication_failure}
  `(
    'returns $message when authetication fail when language is set to $language',
    async ({ language, message }) => {
      await addUser({ ...activeUser, inactive: true });
      const response = await postAuthentication(
        {
          email: 'user1@mail.com',
          password: 'P4ssword'
        },
        { language }
      );

      const error = response.body;

      expect(error.message).toBe(message);
    }
  );

  it('returns 401 when email is not valid', async () => {
    const response = await postAuthentication({
      password: 'P4ssword'
    });

    expect(response.status).toBe(401);
  });
  it('returns 401 when password is not valid', async () => {
    const response = await postAuthentication({
      email: 'user1@mail.com'
    });

    expect(response.status).toBe(401);
  });

  it('return token in response body when credentails are correct', async () => {
    await addUser();
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword'
    });

    expect(response.body.token).not.toBeUndefined();
  });
});

describe('Logout', () => {
  it('return 200 ok when unauthorized request send for logout', async () => {
    const response = await postLogout();

    expect(response.status).toBe(200);
  });

  it('removes token from database', async () => {
    await addUser();
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword'
    });
    const token = response.body.token;
    await postLogout({ token: token });
    const storedToken = await Token.findOne({ where: { token: token } });
    expect(storedToken).toBeNull();
  });
});

describe('Token Expipation', () => {
  const putUser = async (id = 5, body = null, options = {}) => {
    let agent = request(app).put('/api/1.0/users/' + id);

    if (options.token) {
      agent.set('Authorization', `Bearer ${options.token}`);
    }

    return agent.send(body);
  };

  it('returns 403 when token is older than 1 week', async () => {
    const savedUser = await addUser();

    const token = 'test-token';
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 - 1);

    await Token.create({
      token: token,
      userId: savedUser.id,
      lastUseAt: oneWeekAgo
    });

    const validUpdate = { username: 'user1-updated' };

    const response = await putUser(savedUser.id, validUpdate, { token: token });
    expect(response.status).toBe(403);
  });

  it('refresh lastUsedAt when unexpired token', async () => {
    const savedUser = await addUser();

    const token = 'test-token';
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000 - 1);

    await Token.create({
      token: token,
      userId: savedUser.id,
      lastUseAt: fourDaysAgo
    });

    const validUpdate = { username: 'user1-updated' };
    const rightBeforeSendingRequest = new Date();

    await putUser(savedUser.id, validUpdate, { token: token });

    const tokenInDb = await Token.findOne({ where: { token: token } });
    expect(tokenInDb.lastUseAt.getTime()).toBeGreaterThan(
      rightBeforeSendingRequest.getTime()
    );
  });
  it('refresh lastUsedAt when unexpired token is used unautheticated endpoint', async () => {
    const savedUser = await addUser();

    const token = 'test-token';
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000 - 1);

    await Token.create({
      token: token,
      userId: savedUser.id,
      lastUseAt: fourDaysAgo
    });

    const rightBeforeSendingRequest = new Date();

    await request(app)
      .get('/api/1.0/users/5')
      .set('Authorization', `Bearer ${token}`);

    const tokenInDb = await Token.findOne({ where: { token: token } });
    expect(tokenInDb.lastUseAt.getTime()).toBeGreaterThan(
      rightBeforeSendingRequest.getTime()
    );
  });
});
