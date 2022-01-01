const request = require('supertest');
const app = require('../src/app');

const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const en = require('../locals/en/translation.json');
const th = require('../locals/th/translation.json');
const bcrypt = require('bcrypt');

beforeAll(async () => {
  return sequelize.sync();
});

beforeEach(async () => {
  await User.destroy({ truncate: true });
});

const getUsers = (options = {}) => {
  const agent = request(app).get('/api/1.0/users');

  if (options.auth) {
    const { email, password } = options.auth;
    agent.auth(email, password);
  }
  return agent;
};

const addUser = async (activeUserCount, inactiveUserCount = 0) => {
  const hash = await bcrypt.hash('P4ssword', 10);
  for (let i = 0; i < activeUserCount + inactiveUserCount; i++) {
    await User.create({
      username: `user${i + 1}`,
      email: `user${i + 1}@mail.com`,
      inactive: i >= activeUserCount,
      password: hash
    });
  }
};

describe('Listung Users', () => {
  it('returns 200 ok when there is no user in database', async () => {
    const response = await getUsers();
    expect(response.status).toBe(200);
  });
  it('return page object as response body', async () => {
    const response = await getUsers();
    expect(response.body).toEqual({
      content: [],
      page: 0,
      size: 10,
      totalPages: 0
    });
  });

  it('return 10 users in page content when there are 11 users in database', async () => {
    await addUser(11, 0);
    const response = await getUsers();
    expect(response.body.content.length).toBe(10);
  });
  it('return 6 user in page content when there are active 6 users and inactive 5 users', async () => {
    await addUser(6, 5);
    const response = await getUsers();
    expect(response.body.content.length).toBe(6);
  });
  it('returns only id, username and email in content array in each user', async () => {
    await addUser(6, 5);
    const response = await getUsers();
    const user = response.body.content[0];
    expect(Object.keys(user)).toEqual(['id', 'username', 'email']);
  });
  it('returns 2 as totalPages when there are 15 active and 7 inactive user', async () => {
    await addUser(15, 7);
    const response = await getUsers();

    expect(response.body.totalPages).toBe(2);
  });
  it('returns second page users and page indicator when page is set as 1 in request parameter', async () => {
    await addUser(11);
    const response = await getUsers().query({ page: 1 });

    expect(response.body.content[0].username).toBe('user11');
    expect(response.body.page).toBe(1);
  });
  it('returns first page when page is set below zero as request parameter', async () => {
    await addUser(11);
    const response = await getUsers().query({ page: -5 });

    expect(response.body.page).toBe(0);
  });
  it('returns 5 users and corresponding size indicator when size is set as 5 in request parameter', async () => {
    await addUser(11);
    const response = await getUsers().query({ size: 5 });
    expect(response.body.content.length).toBe(5);
    expect(response.body.size).toBe(5);
  });

  it('returns 10 users and corresponding size  indicator when size is set as 1000', async () => {
    await addUser(11);
    const response = await getUsers().query({ size: 1000 });
    expect(response.body.content.length).toBe(10);
    expect(response.body.size).toBe(10);
  });
  it('returns 10 users and corresponding size  indicator when size is set as 0', async () => {
    await addUser(11);
    const response = await getUsers().query({ size: 0 });
    expect(response.body.content.length).toBe(10);
    expect(response.body.size).toBe(10);
  });
  it('returns page as zero and size as 10 when non numeric query params provided for both', async () => {
    await addUser(11);
    const response = await getUsers().query({ size: 'size', psge: 'page' });
    expect(response.body.page).toBe(0);
    expect(response.body.size).toBe(10);
  });
  it('returns user page without logged in user when request is valid authorization', async () => {
    await addUser(11);

    const response = await getUsers({
      auth: { email: 'user1@mail.com', password: 'P4ssword' }
    });
    expect(response.body.totalPages).toBe(1);
  });
});

describe('Get user', () => {
  const gerUser = (id) => {
    return request(app).get('/api/1.0/users/' + id);
  };
  it('returns 404 when user not found', async () => {
    const response = await gerUser(5);
    expect(response.status).toBe(404);
  });

  it.each`
    language | message
    ${'th'}  | ${th.user_not_found}
    ${'en'}  | ${en.user_not_found}
  `(
    'returns $message for unknown user when language is set to $language',
    async ({ language, message }) => {
      const response = await gerUser(5).set('accept-language', language);
      expect(response.body.message).toBe(message);
    }
  );
  it('returns proper body when user not found', async () => {
    const nowInMilli = new Date().getTime();
    const response = await gerUser(5);
    const errors = response.body;
    expect(errors.path).toBe('/api/1.0/users/5');
    expect(errors.timestamp).toBeGreaterThan(nowInMilli);
    expect(Object.keys(errors)).toEqual(['path', 'timestamp', 'message']);
  });
  it('returns 200 when an active user exist', async () => {
    const user = await User.create({
      username: 'user1',
      email: 'user1@mail.com',
      inactive: false
    });

    const respone = await gerUser(user.id);
    expect(respone.status).toBe(200);
  });
  it('returns id, username and email in response body', async () => {
    const user = await User.create({
      username: 'user1',
      email: 'user1@mail.com',
      inactive: false
    });

    const respone = await gerUser(user.id);
    expect(Object.keys(respone.body)).toEqual(['id', 'username', 'email']);
  });
  it('returns 404 when the user inactive', async () => {
    const user = await User.create({
      username: 'user1',
      email: 'user1@mail.com',
      inactive: true
    });

    const respone = await gerUser(user.id);
    expect(respone.status).toBe(404);
  });
});
