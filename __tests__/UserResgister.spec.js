const request = require('supertest');
const app = require('../src/app');

const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const nodmailerStub = require('nodemailer-stub');

beforeAll(() => {
  return sequelize.sync();
});

beforeEach(() => {
  return User.destroy({ truncate: true });
});

const validUser = {
  username: 'user1',
  email: 'user1@mail.com',
  password: 'P4ssword'
};

const postUser = (user = validUser, options = {}) => {
  const agent = request(app).post('/api/1.0/users');

  if (options.language) {
    agent.set('accept-language', options.language);
  }
  return agent.send(user);
};

describe('User Registation', () => {
  it('returns 200 OK when signup request is valid', async () => {
    const response = await postUser();
    expect(response.status).toBe(200);
  });
  it('returns success message when sigup request is valid', async () => {
    const response = await postUser();
    expect(response.body.message).toBe('User created');
  });

  it('save the user to database', async () => {
    await postUser();
    const users = await User.findAll();
    expect(users.length).toBe(1);
  });
  it('save the username and password to database', async () => {
    await postUser();

    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.username).toBe('user1');
    expect(savedUser.email).toBe('user1@mail.com');
  });
  it('hash the password in database', async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.password).not.toBe('P4ssword');
  });

  it('returns 400 when username is null', async () => {
    const response = await postUser({
      username: null,
      email: 'user1@mail.com',
      password: 'P4ssword'
    });
    expect(response.status).toBe(400);
  });

  it('returns validationErrors field in body when validation error occurs', async () => {
    const response = await postUser({
      username: null,
      email: 'user1@mail.com',
      password: 'P4ssword'
    });
    const body = response.body;
    expect(body.validationErrors).not.toBeUndefined();
  });

  const username_null = 'Username cannot be null';
  const username_size = 'Must have min 4 and max 32 characters';
  const email_null = 'E-mail cannot be null';
  const email_invalid = 'E-mail is not valid';
  const password_null = 'Password cannot be null';
  const password_size = 'Password must be at least 6 characters';
  const password_pattern =
    'Password must have at least 1 uppercase, 1 lowercase letter and 1 number';

  const email_inuse = 'Email in use';

  it.each`
    field         | value               | expectedMessage
    ${'username'} | ${null}             | ${username_null}
    ${'username'} | ${'usr'}            | ${username_size}
    ${'username'} | ${'usr'.repeat(33)} | ${username_size}
    ${'email'}    | ${null}             | ${email_null}
    ${'email'}    | ${'mail.com'}       | ${email_invalid}
    ${'email'}    | ${'user@mail'}      | ${email_invalid}
    ${'password'} | ${null}             | ${password_null}
    ${'password'} | ${'P4ssw'}          | ${password_size}
    ${'password'} | ${'alllowercase'}   | ${password_pattern}
    ${'password'} | ${'ALLUPERCASE'}    | ${password_pattern}
    ${'password'} | ${'12345678'}       | ${password_pattern}
    ${'password'} | ${'lowerUPPER'}     | ${password_pattern}
    ${'password'} | ${'lower12345'}     | ${password_pattern}
    ${'password'} | ${'UPPER12345'}     | ${password_pattern}
  `(
    'returns $expectedMessage when $field is $value',
    async ({ field, expectedMessage, value }) => {
      const user = {
        username: 'user1',
        email: 'user1@mail.com',
        password: 'P4ssword'
      };

      user[field] = value;

      const response = await postUser(user, { language: 'en' });
      const body = response.body;

      expect(body.validationErrors[field]).toBe(expectedMessage);
    }
  );
  it(`it return ${email_inuse} when same email already in use`, async () => {
    await User.create({ ...validUser });
    const res = await postUser();
    expect(res.body.validationErrors.email).toBe(email_inuse);
  });
  it('create user in inactive mode', async () => {
    await postUser();
    const user = await User.findAll();
    const savedUser = user[0];
    expect(savedUser.inactive).toBe(true);
  });
  it('create user in inactive mode even the request body cotains inactive to be true', async () => {
    const user = { ...validUser, inactive: true };
    await postUser(user);
    const res = await User.findAll();
    const savedUser = res[0];

    expect(savedUser.inactive).toBe(true);
  });
  it('create an activation for user', async () => {
    await postUser();
    const user = await User.findAll();
    const savedUser = user[0];
    expect(savedUser.activationToken).toBeTruthy();
  });
  it('send an Account activation email with activetionToken', async () => {
    await postUser();
    const lastMail = nodmailerStub.interactsWithMail.lastMail();
    expect(lastMail.to[0]).toBe('user1@mail.com');

    const users = await User.findAll();
    const savedUser = users[0];
    expect(lastMail.content).toContain(savedUser.activationToken);
  });
});

describe('Internationalization', () => {
  const validUser = {
    username: 'user1',
    email: 'user1@mail.com',
    password: 'P4ssword'
  };
  const postUser = (user = validUser) => {
    return request(app)
      .post('/api/1.0/users')
      .set('Accept-language', 'th')
      .send(user);
  };

  const username_null = 'กรอกข้อมูล username';
  const username_size = 'อักขระความยาว 4 ถึง 32 ตัว';
  const email_null = 'กรอกข้อมูล email';
  const email_invalid = 'E-mail ไม่ถูกต้อง';
  const password_null = 'กรอกข้อมูล password';
  const password_size = 'อักขระความยาวอย่างน้อย 6 ตัว';
  const password_pattern =
    'อักขระควรประกอบด้วย 1 ตัวพิมพ์เล็ก, 1 ตัวพิมพ์ใหญ่ และ 1 ตัวเลข';

  const email_inuse = 'Email ถูกใช้งานแล้ว';
  const user_create_success = 'สร้างข้อมูลผู้ใช้งานสำเร็จ';

  it.each`
    field         | value               | expectedMessage
    ${'username'} | ${null}             | ${username_null}
    ${'username'} | ${'usr'}            | ${username_size}
    ${'username'} | ${'usr'.repeat(33)} | ${username_size}
    ${'email'}    | ${null}             | ${email_null}
    ${'email'}    | ${'mail.com'}       | ${email_invalid}
    ${'email'}    | ${'user@mail'}      | ${email_invalid}
    ${'password'} | ${null}             | ${password_null}
    ${'password'} | ${'P4ssw'}          | ${password_size}
    ${'password'} | ${'alllowercase'}   | ${password_pattern}
    ${'password'} | ${'ALLUPERCASE'}    | ${password_pattern}
    ${'password'} | ${'12345678'}       | ${password_pattern}
    ${'password'} | ${'lowerUPPER'}     | ${password_pattern}
    ${'password'} | ${'lower12345'}     | ${password_pattern}
    ${'password'} | ${'UPPER12345'}     | ${password_pattern}
  `(
    'returns $expectedMessage when $field is $value when language is set to thai',
    async ({ field, expectedMessage, value }) => {
      const user = {
        username: 'user1',
        email: 'user1@mail.com',
        password: 'P4ssword'
      };

      user[field] = value;

      const response = await postUser(user, { language: 'th' });
      const body = response.body;

      expect(body.validationErrors[field]).toBe(expectedMessage);
    }
  );

  it(`it return ${email_inuse} when same email already in use when language is set to thai`, async () => {
    await User.create({ ...validUser });
    const res = await postUser({ ...validUser }, { language: 'th' });
    expect(res.body.validationErrors.email).toBe(email_inuse);
  });

  it(`returns success message of ${user_create_success} when sigup request is valid and language is thai`, async () => {
    const res = await postUser({ ...validUser }, { language: 'th' });

    expect(res.body.message).toBe(user_create_success);
  });
});
