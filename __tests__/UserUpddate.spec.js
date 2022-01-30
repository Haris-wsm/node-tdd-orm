const request = require('supertest');
const app = require('../src/app');

const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const bcrypt = require('bcrypt');
const en = require('../locals/en/translation.json');
const th = require('../locals/th/translation.json');

const fs = require('fs');
const path = require('path');

const config = require('config');
const { uploadDir, profileDir } = config;
const profileDirectory = path.join('.', uploadDir, profileDir);

beforeEach(() => {
  return User.destroy({ truncate: { cascade: true } });
});

const putUser = async (id = 5, body = null, options = {}) => {
  let agent = request(app);
  let token;
  if (options.auth) {
    const response = await agent.post('/api/1.0/auth').send(options.auth);
    token = response.body.token;
  }
  agent = agent.put('/api/1.0/users/' + id);

  if (options.language) {
    agent.set('accept-language', options.language);
  }

  if (token) {
    agent.set('Authorization', `Bearer ${token}`);
  }

  if (options.token) {
    agent.set('Authorization', `Bearer ${options.token}`);
  }

  return agent.send(body);
};

const activeUser = {
  username: 'user1',
  email: 'user1@mail.com',
  inactive: false,
  password: 'P4ssword'
};

const credentails = { email: 'user1@mail.com', password: 'P4ssword' };
const addUser = async (user = { ...activeUser }) => {
  const hash = await bcrypt.hash(user.password, 10);
  user.password = hash;
  return await User.create(user);
};

const readFileAsBase64 = (file = 'test-png.png') => {
  const filePath = path.join('.', '__tests__', 'resources', file);
  return fs.readFileSync(filePath, { encoding: 'base64' });
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
    await addUser();

    const userTobeUpdated = await addUser({
      ...activeUser,
      username: 'user2',
      email: 'user2@mail.com'
    });
    const response = await putUser(userTobeUpdated.id, null, {
      auth: credentails
    });

    expect(response.status).toBe(403);
  });
  it('returns fobidden when update request is sent by inactive user with correct credentails for it own user', async () => {
    const user = await addUser({ ...activeUser, inactive: true });

    const response = await putUser(user.id, null, {
      auth: credentails
    });

    expect(response.status).toBe(403);
  });
  it('returns 200 when valid update request send from authorized user', async () => {
    const savedUser = await addUser();
    const validUpdate = { username: 'user-1-updated' };
    const response = await putUser(savedUser.id, validUpdate, {
      auth: credentails
    });

    expect(response.status).toBe(200);
  });
  it('updates username in database when valid update request is sent from authorize user', async () => {
    const savedUser = await addUser();
    const validUpdate = { username: 'user-1-updated' };
    await putUser(savedUser.id, validUpdate, {
      auth: credentails
    });

    const inDBUser = await User.findOne({ where: { id: savedUser.id } });
    expect(inDBUser.username).toBe(validUpdate.username);
  });
  it('returns 403 when token is not valid', async () => {
    const response = await putUser(5, null, { token: '123' });
    expect(response.status).toBe(403);
  });
  it('saves the user image when update contains image as base64', async () => {
    const fileBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const validUpdate = { username: 'user-1-updated', image: fileBase64 };
    await putUser(savedUser.id, validUpdate, {
      auth: credentails
    });

    const inDBUser = await User.findOne({ where: { id: savedUser.id } });
    expect(inDBUser.image).toBeTruthy();
  });
  it('returns success body having only id, username, email and image', async () => {
    const fileBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const validUpdate = { username: 'user-1-updated', image: fileBase64 };
    const response = await putUser(savedUser.id, validUpdate, {
      auth: credentails
    });

    expect(Object.keys(response.body)).toEqual(['id', 'username', 'image']);
  });

  it('saves the user image to upload folder and stores filename in user when update as image', async () => {
    const fileBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const validUpdate = { username: 'user-1-updated', image: fileBase64 };
    await putUser(savedUser.id, validUpdate, {
      auth: credentails
    });

    const inDBUser = await User.findOne({ where: { id: savedUser.id } });

    const profileImageDir = path.join(profileDirectory, inDBUser.image);
    expect(fs.existsSync(profileImageDir)).toBeTruthy();
  });
  it('removes the old image after user upload new one', async () => {
    const fileBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const validUpdate = { username: 'user-1-updated', image: fileBase64 };
    const response = await putUser(savedUser.id, validUpdate, {
      auth: credentails
    });

    const firstImage = response.body.image;
    await putUser(savedUser.id, validUpdate, {
      auth: credentails
    });

    const profileImageDir = path.join(profileDirectory, firstImage);
    expect(fs.existsSync(profileImageDir)).toBe(false);
  });

  it.each`
    language | value             | message
    ${'en'}  | ${'usr'}          | ${en.username_size}
    ${'en'}  | ${null}           | ${en.username_null}
    ${'en'}  | ${'a'.repeat(33)} | ${en.username_size}
    ${'th'}  | ${'usr'}          | ${th.username_size}
    ${'th'}  | ${null}           | ${th.username_null}
    ${'th'}  | ${'a'.repeat(33)} | ${th.username_size}
  `(
    'returns bad request with $message when username is updated with $value when language is set as $language',
    async ({ language, value, message }) => {
      const savedUser = await addUser();
      const invalidUpdate = { username: value };
      const response = await putUser(savedUser.id, invalidUpdate, {
        auth: credentails,
        language: language
      });

      expect(response.body.validationErrors.username).toBe(message);
    }
  );

  it('returns 200 when image size is exactly 2mb', async () => {
    const testPng = readFileAsBase64();
    const pngByte = Buffer.from(testPng, 'base64').length;
    const twoMB = 1024 * 1024 * 2;
    const filling = 'a'.repeat(twoMB - pngByte);
    const fillBase64 = Buffer.from(filling).toString('base64');
    const savedUser = await addUser();
    const validUpdate = {
      username: 'user-updated',
      image: testPng + fillBase64
    };
    const response = await putUser(savedUser.id, validUpdate, {
      auth: credentails
    });
    expect(response.status).toBe(200);
  });
  it('returns 400 when image size exceeds 2mb', async () => {
    const fileWithExceeding2MB = 'a'.repeat(1024 * 1024 * 2) + 'a';
    const base64 = Buffer.from(fileWithExceeding2MB).toString('base64');
    const savedUser = await addUser();
    const invalidUpdate = { username: 'user-updated', image: base64 };
    const response = await putUser(savedUser.id, invalidUpdate, {
      auth: credentails
    });

    expect(response.status).toBe(400);
  });

  it('keeps the old image when user only update username', async () => {
    const fileBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const validUpdate = { username: 'user-1-updated', image: fileBase64 };
    const response = await putUser(savedUser.id, validUpdate, {
      auth: credentails
    });

    const firstImage = response.body.image;
    await putUser(
      savedUser.id,
      { username: 'update-username2' },
      {
        auth: credentails
      }
    );

    const profileImageDir = path.join(profileDirectory, firstImage);
    expect(fs.existsSync(profileImageDir)).toBe(true);

    const userInDb = await User.findOne({ where: { id: savedUser.id } });
    expect(userInDb.image).toBe(firstImage);
  });
  it.each`
    language | message
    ${'en'}  | ${en.profile_image_size}
    ${'th'}  | ${th.profile_image_size}
  `(
    'returns $message when file size exeeds 2mb when language is set as $language',
    async ({ language, message }) => {
      const fileWithExceeding2MB = 'a'.repeat(1024 * 1024 * 2) + 'a';
      const base64 = Buffer.from(fileWithExceeding2MB).toString('base64');
      const savedUser = await addUser();
      const invalidUpdate = { username: 'user-updated', image: base64 };
      const response = await putUser(savedUser.id, invalidUpdate, {
        auth: credentails,
        language
      });

      expect(response.body.validationErrors.image).toBe(message);
    }
  );
  it.each`
    file              | status
    ${'test-gif.gif'} | ${400}
    ${'test-pdf.pdf'} | ${400}
    ${'test-txt.txt'} | ${400}
    ${'test-png.png'} | ${200}
    ${'test-jpg.jpg'} | ${200}
  `(
    'returns $status when uploading $file as image',
    async ({ file, status }) => {
      const fileBase64 = readFileAsBase64(file);
      const savedUser = await addUser();
      const updateBody = { username: 'user-1-updated', image: fileBase64 };
      const response = await putUser(savedUser.id, updateBody, {
        auth: credentails
      });

      expect(response.status).toBe(status);
    }
  );

  it.each`
    file              | language | message
    ${'test-gif.gif'} | ${'th'}  | ${th.unsupported_image_file}
    ${'test-gif.gif'} | ${'en'}  | ${en.unsupported_image_file}
    ${'test-pdf.pdf'} | ${'th'}  | ${th.unsupported_image_file}
    ${'test-pdf.pdf'} | ${'th'}  | ${th.unsupported_image_file}
    ${'test-pdf.pdf'} | ${'en'}  | ${en.unsupported_image_file}
    ${'test-txt.txt'} | ${'th'}  | ${th.unsupported_image_file}
    ${'test-txt.txt'} | ${'en'}  | ${en.unsupported_image_file}
  `(
    'returns $message when uploading $file as image when language is $language',
    async ({ message, language, file }) => {
      const fileBase64 = readFileAsBase64(file);
      const savedUser = await addUser();
      const updateBody = { username: 'user-1-updated', image: fileBase64 };
      const response = await putUser(savedUser.id, updateBody, {
        auth: credentails,
        language
      });

      expect(response.body.validationErrors.image).toBe(message);
    }
  );
});
