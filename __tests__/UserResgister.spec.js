const request = require('supertest');
const app = require('../src/app');

const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const SMTPSERVER = require('smtp-server').SMTPServer;
const en = require('../locals/en/translation.json');
const th = require('../locals/th/translation.json');

const config = require('config');

let lastMail, server;
let simulateSmtpFailure = false;

beforeAll(async () => {
  server = new SMTPSERVER({
    authOptional: true,
    onData(stream, session, callback) {
      let mailBody;

      stream.on('data', (data) => {
        mailBody += data.toString();
      });

      stream.on('end', () => {
        if (simulateSmtpFailure) {
          const err = new Error('Invalid mailbox');
          err.responseCode = 553;
          return callback(err);
        }
        lastMail = mailBody;
        callback();
      });
    }
  });

  await server.listen(config.mail.port, 'localhost');
});

beforeEach(async () => {
  simulateSmtpFailure = false;
  await User.destroy({ truncate: { cascade: true } });
});

afterAll(async () => {
  await server.close();
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
    expect(response.body.message).toBe(en.user_create_success);
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

  // const username_null = 'Username cannot be null';
  // const username_size = 'Must have min 4 and max 32 characters';
  // const email_null = 'E-mail cannot be null';
  // const email_invalid = 'E-mail is not valid';
  // const password_null = 'Password cannot be null';
  // const password_size = 'Password must be at least 6 characters';
  // const password_pattern =
  //   'Password must have at least 1 uppercase, 1 lowercase letter and 1 number';

  // const email_inuse = 'Email in use';
  // const validation_failure = 'Validation failure';

  it.each`
    field         | value             | expectedMessage
    ${'username'} | ${null}           | ${en.username_null}
    ${'username'} | ${'usr'}          | ${en.username_size}
    ${'username'} | ${'a'.repeat(33)} | ${en.username_size}
    ${'email'}    | ${null}           | ${en.email_null}
    ${'email'}    | ${'mail.com'}     | ${en.email_invalid}
    ${'email'}    | ${'user@mail'}    | ${en.email_invalid}
    ${'password'} | ${null}           | ${en.password_null}
    ${'password'} | ${'P4ssw'}        | ${en.password_size}
    ${'password'} | ${'alllowercase'} | ${en.password_pattern}
    ${'password'} | ${'ALLUPERCASE'}  | ${en.password_pattern}
    ${'password'} | ${'12345678'}     | ${en.password_pattern}
    ${'password'} | ${'lowerUPPER'}   | ${en.password_pattern}
    ${'password'} | ${'lower12345'}   | ${en.password_pattern}
    ${'password'} | ${'UPPER12345'}   | ${en.password_pattern}
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
  it(`it return ${en.email_inuse} when same email already in use`, async () => {
    await User.create({ ...validUser });
    const res = await postUser();
    expect(res.body.validationErrors.email).toBe(en.email_inuse);
  });
  it('create user in inactive mode', async () => {
    await postUser();
    const user = await User.findAll();
    const savedUser = user[0];
    expect(savedUser.inactive).toBe(true);
  });
  it('create user in inactive mode even the request body cotains inactive is false', async () => {
    const user = { ...validUser, inactive: false };
    await postUser(user);
    const res = await User.findAll();
    const savedUser = res[0];

    expect(savedUser.inactive).toBe(true);
  });
  it('create an activation token for user', async () => {
    await postUser();
    const user = await User.findAll();
    const savedUser = user[0];
    expect(savedUser.activationToken).toBeTruthy();
  });
  it('send an Account activation email with activetionToken', async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(lastMail).toContain('user1@mail.com');
    expect(lastMail).toContain(savedUser.activationToken);
  });
  it('return 502 Bad gateway when sending email fails', async () => {
    simulateSmtpFailure = true;
    const response = await postUser();
    expect(response.status).toBe(502);
  });
  it('return Email failure message when sending email fails', async () => {
    simulateSmtpFailure = true;
    const response = await postUser();
    expect(response.body.message).toBe('E-mail Failure');
  });
  it('does not save user into database if activation email fails', async () => {
    simulateSmtpFailure = true;
    await postUser();
    const users = await User.findAll();
    expect(users.length).toBe(0);
  });

  it('returns validation failure message in error response body when validation fails', async () => {
    const response = await postUser({
      username: null,
      email: 'user1@mail.com',
      password: 'P4ssword'
    });

    expect(response.body.message).toBe(en.validation_failure);
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

  // const username_null = 'กรอกข้อมูล username';
  // const username_size = 'อักขระความยาว 4 ถึง 32 ตัว';
  // const email_null = 'กรอกข้อมูล email';
  // const email_invalid = 'E-mail ไม่ถูกต้อง';
  // const password_null = 'กรอกข้อมูล password';
  // const password_size = 'อักขระความยาวอย่างน้อย 6 ตัว';
  // const password_pattern =
  //   'อักขระควรประกอบด้วย 1 ตัวพิมพ์เล็ก, 1 ตัวพิมพ์ใหญ่ และ 1 ตัวเลข';

  // const email_inuse = 'Email ถูกใช้งานแล้ว';
  // const user_create_success = 'สร้างข้อมูลผู้ใช้งานสำเร็จ';
  // const email_failure = 'เกิดข้อผิดพลาด การส่ง อีเมล';
  // const validation_failure = 'ข้อมูลไม่ถูกต้อง';

  it.each`
    field         | value               | expectedMessage
    ${'username'} | ${'usr'}            | ${th.username_size}
    ${'username'} | ${null}             | ${th.username_null}
    ${'username'} | ${'usr'.repeat(33)} | ${th.username_size}
    ${'email'}    | ${null}             | ${th.email_null}
    ${'email'}    | ${'mail.com'}       | ${th.email_invalid}
    ${'email'}    | ${'user@mail'}      | ${th.email_invalid}
    ${'password'} | ${null}             | ${th.password_null}
    ${'password'} | ${'P4ssw'}          | ${th.password_size}
    ${'password'} | ${'alllowercase'}   | ${th.password_pattern}
    ${'password'} | ${'ALLUPERCASE'}    | ${th.password_pattern}
    ${'password'} | ${'12345678'}       | ${th.password_pattern}
    ${'password'} | ${'lowerUPPER'}     | ${th.password_pattern}
    ${'password'} | ${'lower12345'}     | ${th.password_pattern}
    ${'password'} | ${'UPPER12345'}     | ${th.password_pattern}
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

  it(`it return ${th.email_inuse} when same email already in use when language is set to thai`, async () => {
    await User.create({ ...validUser });
    const res = await postUser({ ...validUser }, { language: 'th' });
    expect(res.body.validationErrors.email).toBe(th.email_inuse);
  });

  it(`returns success message of ${th.user_create_success} when sigup request is valid and language is thai`, async () => {
    const res = await postUser({ ...validUser }, { language: 'th' });

    expect(res.body.message).toBe(th.user_create_success);
  });

  it(`return ${th.email_failure} message when sending email fails and language is thai`, async () => {
    simulateSmtpFailure = true;
    const response = await postUser();
    expect(response.body.message).toBe(th.email_failure);
  });

  it(`returns ${th.validation_failure} message in error response body when validation fails`, async () => {
    const response = await postUser(
      {
        username: null,
        email: 'user1@mail.com',
        password: 'P4ssword'
      },
      { language: 'th' }
    );

    expect(response.body.message).toBe(th.validation_failure);
  });
});

describe('Account activation', () => {
  it('activates the account when correct token is sent', async () => {
    await postUser();
    let users = await User.findAll();
    const token = users[0].activationToken;

    await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();

    users = await User.findAll();

    expect(users[0].inactive).toBe(false);
  });
  it('removes user token from user table after successful activation', async () => {
    await postUser();
    let users = await User.findAll();
    const token = users[0].activationToken;

    await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();

    users = await User.findAll();

    expect(users[0].activationToken).toBeFalsy();
  });
  it('does not activate the account when token is wrong', async () => {
    await postUser();
    const token = 'this-token-does-not-exist';

    await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();

    users = await User.findAll();

    expect(users[0].inactive).toBe(true);
  });
  it('returns Bad request when token is wrong', async () => {
    await postUser();
    const token = 'this-token-does-not-exist';

    const response = await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();

    expect(response.status).toBe(400);
  });

  it.each`
    language | tokenStatus  | message
    ${'th'}  | ${'wrong'}   | ${th.account_activation_failure}
    ${'en'}  | ${'wrong'}   | ${en.account_activation_failure}
    ${'th'}  | ${'correct'} | ${th.account_activation_success}
    ${'en'}  | ${'correct'} | ${en.account_activation_success}
  `(
    `return $message when token is $tokenStatus is sent and language is $language`,
    async ({ language, tokenStatus, message }) => {
      await postUser();
      let token = 'this-token-does-not-exist';

      if (tokenStatus === 'correct') {
        const users = await User.findAll();
        token = users[0].activationToken;
      }

      const response = await request(app)
        .post('/api/1.0/users/token/' + token)
        .set('accept-language', language)
        .send();

      expect(response.body.message).toBe(message);
    }
  );
});

describe('Error model', () => {
  it('returns path, timestamp, message and validationErrors in response when validation failure', async () => {
    const response = await postUser({ ...validUser, username: null });
    const body = response.body;
    expect(Object.keys(body)).toEqual([
      'path',
      'timestamp',
      'message',
      'validationErrors'
    ]);
  });

  it('returns path, timestamp, message in response when request fails other than validation error', async () => {
    await postUser();
    const token = 'this-token-does-not-exist';

    const response = await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();

    expect(Object.keys(response.body)).toEqual([
      'path',
      'timestamp',
      'message'
    ]);
  });
  it('returns path in error body', async () => {
    await postUser();
    const token = 'this-token-does-not-exist';

    const response = await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();

    const body = response.body;

    expect(body.path).toEqual('/api/1.0/users/token/' + token);
  });
  it('returns timestamp in millisecond within 5 seconds value in error body', async () => {
    const nowInMilli = new Date().getTime();
    const fiveSecondLater = nowInMilli + 5 * 1000;
    await postUser();
    const token = 'this-token-does-not-exist';
    const response = await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();

    const body = response.body;

    expect(body.timestamp).toBeGreaterThan(nowInMilli);
    expect(body.timestamp).toBeLessThan(fiveSecondLater);
  });
});
