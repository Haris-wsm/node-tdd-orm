const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const Token = require('../src/auth/Token');
const SMTPSERVER = require('smtp-server').SMTPServer;

const sequelize = require('../src/config/database');
const bcrypt = require('bcrypt');
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
  return sequelize.sync();
});

beforeEach(() => {
  simulateSmtpFailure = false;
  return User.destroy({ truncate: { cascade: true } });
});

afterAll(async () => {
  await server.close();
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

const postpasswordReset = async (email = 'user1@mail.com', options = {}) => {
  let agent = request(app).post('/api/1.0/user/password');
  if (options.language) {
    agent.set('accept-language', options.language);
  }
  return agent.send({ email });
};

const putPasswordUpdate = (body, options = {}) => {
  let agent = request(app).put('/api/1.0/user/password');

  if (options.language) {
    agent.set('accept-language', options.language);
  }
  return agent.send(body);
};

describe('Password reset request', () => {
  it('return 404 when password reset request is sent from unknown email', async () => {
    const response = await postpasswordReset();
    expect(response.status).toBe(404);
  });

  it.each`
    language | message
    ${'th'}  | ${th.email_not_inuse}
    ${'en'}  | ${en.email_not_inuse}
  `(
    'returns error body with $message for unknown email for password reset when language is $language',
    async ({ language, message }) => {
      const nowInMillis = new Date().getTime();

      const response = await postpasswordReset('user1@mail.com', {
        language: language
      });
      expect(response.status).toBe(404);

      expect(response.body.message).toBe(message);
      expect(response.body.timestamp).toBeGreaterThan(nowInMillis);
      expect(response.body.path).toBe('/api/1.0/user/password');
    }
  );
  it.each`
    language | message
    ${'th'}  | ${th.email_invalid}
    ${'en'}  | ${en.email_invalid}
  `(
    'returns 400 with validation error response having $message when request does not have valid email and language is $language',
    async ({ language, message }) => {
      const response = await postpasswordReset('', {
        language: language
      });
      expect(response.status).toBe(400);

      expect(response.body.validationErrors.email).toBe(message);
    }
  );
  it('return 200 ok when a password reset request is sent for known email', async () => {
    const user = await addUser();
    const response = await postpasswordReset(user.email);
    expect(response.status).toBe(200);
  });

  it.each`
    language | message
    ${'th'}  | ${th.password_reset_request_success}
    ${'en'}  | ${en.password_reset_request_success}
  `(
    'return success response body with $messagefor known email for password reset request when language is set as $language',
    async ({ language, message }) => {
      const user = await addUser();
      const response = await postpasswordReset(user.email, {
        language: language
      });
      expect(response.body.message).toBe(message);
    }
  );
  it('creates password token when a password reset request is sent for known email', async () => {
    const user = await addUser();
    await postpasswordReset(user.email);
    const userInDb = await User.findOne({ where: { email: user.email } });
    expect(userInDb.passwordResetToken).toBeTruthy();
  });

  it('sends a password reset email with passwordResetToken', async () => {
    const user = await addUser();
    await postpasswordReset(user.email);
    const userInDb = await User.findOne({ where: { email: user.email } });
    const passwordResetToken = userInDb.passwordResetToken;
    expect(lastMail).toContain(user.email);
    expect(lastMail).toContain(passwordResetToken);
  });

  it('returns 502 Bad Gatewat when sending email fails', async () => {
    simulateSmtpFailure = true;
    const user = await addUser();
    const response = await postpasswordReset(user.email);
    expect(response.status).toBe(502);
  });

  it.each`
    language | message
    ${'th'}  | ${th.email_failure}
    ${'en'}  | ${en.email_failure}
  `(
    'returns $message when language is $language after email failure',
    async ({ language, message }) => {
      simulateSmtpFailure = true;
      const user = await addUser();
      const response = await postpasswordReset(user.email, {
        language: language
      });
      expect(response.body.message).toBe(message);
    }
  );
});

describe('Password Update', () => {
  it('returns 403 when password update request does not have a valid password reset token', async () => {
    const response = await putPasswordUpdate({
      password: 'P4ssword',
      passwordResetToken: 'abc'
    });
    expect(response.status).toBe(403);
  });
  it.each`
    language | message
    ${'th'}  | ${th.unauthorize_password_reset}
    ${'en'}  | ${en.unauthorize_password_reset}
  `(
    'returns error body with $message when language is set to $language after tying to update with invalid token',
    async ({ language, message }) => {
      const nowInMillis = new Date(Date.now()).getTime();
      const response = await putPasswordUpdate(
        {
          password: 'P4ssword',
          passwordResetToken: 'abc'
        },
        { language }
      );

      expect(response.body.message).toBe(message);
      expect(response.body.path).toBe('/api/1.0/user/password');
      expect(response.body.timestamp).toBeGreaterThan(nowInMillis);
    }
  );
  it('returns 403 when password update request with invalid password pattern and reset token is invalid', async () => {
    const response = await putPasswordUpdate({
      password: 'not-valid',
      passwordResetToken: 'abc'
    });

    expect(response.status).toBe(403);
  });
  it('returns 400 when trying to update invalid password and the reset token is valid', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await user.save();
    const response = await putPasswordUpdate({
      password: 'not-valid',
      passwordResetToken: 'test-token'
    });

    expect(response.status).toBe(400);
  });

  it.each`
    language | value             | expectedMessage
    ${'en'}  | ${null}           | ${en.password_null}
    ${'en'}  | ${'P4ssw'}        | ${en.password_size}
    ${'en'}  | ${'alllowercase'} | ${en.password_pattern}
    ${'en'}  | ${'ALLUPERCASE'}  | ${en.password_pattern}
    ${'en'}  | ${'12345678'}     | ${en.password_pattern}
    ${'en'}  | ${'lowerUPPER'}   | ${en.password_pattern}
    ${'en'}  | ${'lower12345'}   | ${en.password_pattern}
    ${'en'}  | ${'UPPER12345'}   | ${en.password_pattern}
    ${'th'}  | ${null}           | ${th.password_null}
    ${'th'}  | ${'P4ssw'}        | ${th.password_size}
    ${'th'}  | ${'alllowercase'} | ${th.password_pattern}
    ${'th'}  | ${'ALLUPERCASE'}  | ${th.password_pattern}
    ${'th'}  | ${'12345678'}     | ${th.password_pattern}
    ${'th'}  | ${'lowerUPPER'}   | ${th.password_pattern}
    ${'th'}  | ${'lower12345'}   | ${th.password_pattern}
    ${'th'}  | ${'UPPER12345'}   | ${th.password_pattern}
  `(
    'returns password validation error $expectedMessage when language is set to $language and the value is $value',
    async ({ language, expectedMessage, value }) => {
      const user = await addUser();
      user.passwordResetToken = 'test-token';
      await user.save();
      const response = await putPasswordUpdate(
        {
          password: value,
          passwordResetToken: 'test-token'
        },
        { language }
      );

      expect(response.body.validationErrors.password).toBe(expectedMessage);
    }
  );

  it('returns 200 when valid password is sent with valid reset token', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await user.save();
    const response = await putPasswordUpdate({
      password: 'N3w-password',
      passwordResetToken: 'test-token'
    });

    expect(response.status).toBe(200);
  });
  it('updates the password in database when the request is valid', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await user.save();
    await putPasswordUpdate({
      password: 'N3w-password',
      passwordResetToken: 'test-token'
    });

    const userInDb = await User.findOne({ where: { email: user.email } });

    expect(userInDb.password).not.toEqual(user.password);
  });
  it('clears the reset token in database when the request is valid', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await user.save();
    await putPasswordUpdate({
      password: 'N3w-password',
      passwordResetToken: 'test-token'
    });

    const userInDb = await User.findOne({ where: { email: user.email } });

    expect(userInDb.passwordResetToken).toBeFalsy();
  });
  it('activates and clears activation token if the account is inactive after valid password reset', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    user.activationToken = 'activation-token';
    user.inactive = true;
    await user.save();

    await putPasswordUpdate({
      password: 'N3w-password',
      passwordResetToken: 'test-token'
    });

    const userInDb = await User.findOne({ where: { email: user.email } });

    expect(userInDb.activationToken).toBeFalsy();
    expect(userInDb.inactive).toBe(false);
  });
  it('clears all tokens of user after valid password reset', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    user.activationToken = 'activation-token';
    user.inactive = true;
    await user.save();
    await Token.create({
      token: 'token-1',
      userId: user.id,
      lastUsedAt: Date.now()
    });

    await putPasswordUpdate({
      password: 'N3w-password',
      passwordResetToken: 'test-token'
    });

    const tokens = await Token.findAll({ where: { userId: user.id } });

    expect(tokens.length).toBe(0);
  });
});
