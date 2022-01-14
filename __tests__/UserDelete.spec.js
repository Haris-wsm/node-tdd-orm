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

const deleteUser = async (id = 5, options = {}) => {
  const agent = request(app).delete('/api/1.0/users/' + id);

  if (options.language) {
    agent.set('accept-language', options.language);
  }

  if (options.token) {
    agent.set('Authorization', `Bearer ${options.token}`);
  }

  return agent.send();
};

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

const auth = async (options = {}) => {
  let agent = request(app);
  let token;
  if (options.auth) {
    const response = await agent.post('/api/1.0/auth').send(options.auth);
    token = response.body.token;
  }
  return token;
};

describe('User Delete', () => {
  it('returns forbidden when request send unauthorized', async () => {
    const response = await deleteUser(5);

    expect(response.status).toBe(403);
  });

  it.each`
    language | message
    ${'th'}  | ${th.unauthorized_user_delete}
    ${'en'}  | ${en.unauthorized_user_delete}
  `(
    'returns error body with $message for unauthorized request when language is $language',
    async ({ language, message }) => {
      const nowInMillis = new Date().getTime();
      const response = await deleteUser(5, { language });

      expect(response.body.message).toBe(message);
      expect(response.body.timestamp).toBeGreaterThan(nowInMillis);
      expect(response.body.path).toBe('/api/1.0/users/5');
    }
  );

  it('returns fobidden when delete request is sent with correct credentails but for different user', async () => {
    await addUser();

    const userToBeDelete = await addUser({
      ...activeUser,
      username: 'user2',
      email: 'user2@mail.com'
    });

    const token = await auth({
      auth: { email: 'user1@mail.com', password: 'P4ssword' }
    });
    const response = await deleteUser(userToBeDelete.id, {
      token: token
    });

    expect(response.status).toBe(403);
  });
  it('returns 403 when token is not valid', async () => {
    const response = await deleteUser(5, { token: '123' });
    expect(response.status).toBe(403);
  });

  it('returns 200 when valid delete request send from authorized user', async () => {
    const savedUser = await addUser();

    const token = await auth({
      auth: { email: 'user1@mail.com', password: 'P4ssword' }
    });
    const response = await deleteUser(savedUser.id, {
      token: token
    });

    expect(response.status).toBe(200);
  });
  it('deletes user from database when request is sent from authorize user', async () => {
    const savedUser = await addUser();
    const token = await auth({
      auth: { email: 'user1@mail.com', password: 'P4ssword' }
    });
    await deleteUser(savedUser.id, {
      token: token
    });
    const inDBUser = await User.findOne({ where: { id: savedUser.id } });
    expect(inDBUser).toBeNull();
  });
  it('deletes token from database when delete user requestt is sent from authorize user', async () => {
    const savedUser = await addUser();
    const token = await auth({
      auth: { email: 'user1@mail.com', password: 'P4ssword' }
    });
    await deleteUser(savedUser.id, {
      token: token
    });

    const tokenInD = await Token.findOne({ where: { token: token } });
    expect(tokenInD).toBeNull();
  });
  it('deletes all token from database when delete user requestt is sent from authorize user', async () => {
    const savedUser = await addUser();
    const token1 = await auth({
      auth: { email: 'user1@mail.com', password: 'P4ssword' }
    });
    const token2 = await auth({
      auth: { email: 'user1@mail.com', password: 'P4ssword' }
    });
    await deleteUser(savedUser.id, {
      token: token1
    });

    const tokenInD = await Token.findOne({ where: { token: token2 } });
    expect(tokenInD).toBeNull();
  });
});
