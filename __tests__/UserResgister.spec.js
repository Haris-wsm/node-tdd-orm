const request = require('supertest');
const app = require('../src/app');

const User = require('../src/user/User');
const sequelize = require('../src/config/database');

beforeAll(() => {
  return sequelize.sync();
});

beforeEach(() => {
  return User.destroy({ truncate: true });
});

describe('User Registation', () => {
  const postValidUser = () => {
    return request(app).post('/api/1.0/users').send({
      username: 'user1',
      email: 'user1@mail.com',
      password: 'P4ssword'
    });
  };
  it('returns 200 OK when signup request is valid', async () => {
    const response = await postValidUser();
    expect(response.status).toBe(200);
  });
  it('returns success message when sigup request is valid', async () => {
    const response = await postValidUser();
    expect(response.body.message).toBe('User created');
  });

  it('save the user to database', async () => {
    await postValidUser();
    const users = await User.findAll();
    expect(users.length).toBe(1);
  });
  it('save the username and password to database', async () => {
    await postValidUser();

    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.username).toBe('user1');
    expect(savedUser.email).toBe('user1@mail.com');
  });
  it('hash the password in database', async () => {
    await postValidUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.password).not.toBe('P4ssword');
  });
});
