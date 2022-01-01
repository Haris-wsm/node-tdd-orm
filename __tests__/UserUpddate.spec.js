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

const putUser = (id = 5, body = null, options = {}) => {
  const agent = request(app).put('/api/1.0/users/' + id);

  if (options.language) {
    agent.set('accept-language', options.language);
  }
  if (options.auth) {
    const { email, password } = options.auth;
    agent.auth(email, password);
  }

  return agent.send(body);
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

describe('User update', () => {
  it('returns forbidden when request send without basic authorization', async () => {
    const response = await putUser(5);

    expect(response.status).toBe(403);
  });

  it.each`
    language | message
    ${'th'}  | ${th.unauthorized_user_update}
    ${'en'}  | ${en.unauthorized_user_update}
  `(
    'returns error body with $message for unauthorized request when language is $language',
    async ({ language, message }) => {
      const nowInMillis = new Date().getTime();
      const response = await putUser(5, null, { language });

      expect(response.body.message).toBe(message);
      expect(response.body.timestamp).toBeGreaterThan(nowInMillis);
      expect(response.body.path).toBe('/api/1.0/users/5');
    }
  );

  it('returns forbidden when request sent with incorrect email in basic authorization', async () => {
    await addUser();
    const response = await putUser(5, null, {
      auth: { email: 'user1000@mail.com', password: 'P4ssword' }
    });

    expect(response.status).toBe(403);
  });
  it('returns forbidden when request sent with incorrect password in basic authorization', async () => {
    const user = await addUser();
    const response = await putUser(5, null, {
      auth: { email: 'user1@mail.com', password: 'password' }
    });

    expect(response.status).toBe(403);
  });

  it('returns fobidden when update request is sent with correct credentails but for different user', async () => {
    const user = await addUser();

    const userTobeUpdated = await addUser({
      ...activeUser,
      username: 'user2',
      email: 'user2@mail.com'
    });
    const response = await putUser(userTobeUpdated.id, null, {
      auth: { email: 'user1@mail.com', password: 'P4ssword' }
    });

    expect(response.status).toBe(403);
  });
  it('returns fobidden when update request is sent by inactive user with correct credentails for it own user', async () => {
    const user = await addUser({ ...activeUser, inactive: true });

    const response = await putUser(user.id, null, {
      auth: { email: 'user1@mail.com', password: 'P4ssword' }
    });

    expect(response.status).toBe(403);
  });
  it('returns 200 when valid update request send from authorized user', async () => {
    const savedUser = await addUser();
    const validUpdate = { username: 'user-1-updated' };
    const response = await putUser(savedUser.id, validUpdate, {
      auth: { email: 'user1@mail.com', password: 'P4ssword' }
    });

    expect(response.status).toBe(200);
  });
  it('updates username in database when valid update request is sent from authorize user', async () => {
    const savedUser = await addUser();
    const validUpdate = { username: 'user-1-updated' };
    await putUser(savedUser.id, validUpdate, {
      auth: { email: 'user1@mail.com', password: 'P4ssword' }
    });

    const inDBUser = await User.findOne({ where: { id: savedUser.id } });
    expect(inDBUser.username).toBe(validUpdate.username);
  });
});
