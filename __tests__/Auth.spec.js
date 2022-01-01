const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const bcrypt = require('bcrypt');
const en = require('../locals/en/translation.json');
const th = require('../locals/th/translation.json');

beforeAll(() => {
  return sequelize.sync();
});

beforeEach(() => {
  return User.destroy({ truncate: true });
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

describe('Authentication', () => {
  it('returns 200 when credentail are correct', async () => {
    await addUser();
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword'
    });

    expect(response.status).toBe(200);
  });

  it('returns only id and username when login success', async () => {
    const user = await addUser();
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword'
    });

    expect(response.body.id).toBe(user.id);
    expect(response.body.username).toBe(user.username);
    expect(Object.keys(response.body)).toEqual(['id', 'username']);
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
});
