const request = require('supertest');
const app = require('../src/app');

const User = require('../src/user/User');
const Token = require('../src/auth/Token');
const Hoax = require('../src/hoax/Hoax');
const FileAttachment = require('../src/file/FileAttachment');
const bcrypt = require('bcrypt');
const en = require('../locals/en/translation.json');
const th = require('../locals/th/translation.json');
const fs = require('fs');
const path = require('path');
const config = require('config');
const { user } = require('pg/lib/defaults');

const { uploadDir, profileDir, attachmentDir } = config;
const profileFolder = path.join('.', uploadDir, profileDir);
const attachmentFolder = path.join('.', uploadDir, attachmentDir);

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

const credentails = { email: 'user1@mail.com', password: 'P4ssword' };
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
      auth: credentails
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
      auth: credentails
    });
    const response = await deleteUser(savedUser.id, {
      token: token
    });

    expect(response.status).toBe(200);
  });
  it('deletes user from database when request is sent from authorize user', async () => {
    const savedUser = await addUser();
    const token = await auth({
      auth: credentails
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
      auth: credentails
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
      auth: credentails
    });
    const token2 = await auth({
      auth: credentails
    });
    await deleteUser(savedUser.id, {
      token: token1
    });

    const tokenInD = await Token.findOne({ where: { token: token2 } });
    expect(tokenInD).toBeNull();
  });

  it('deletes hoax from database when delete user request sent from authorized', async () => {
    const savedUser = await addUser();
    const token = await auth({
      auth: credentails
    });

    await request(app)
      .post('/api/1.0/hoaxes')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hoax content' });

    await deleteUser(savedUser.id, {
      token: token
    });
    const hoaxes = await Hoax.findAll();
    expect(hoaxes.length).toBe(0);
  });

  it('removes profile image when user is deleted', async () => {
    const user = await addUser();
    const token = await auth({ auth: credentails });
    const storeFilename = 'profile-image-user1';

    const testFilePath = path.join(
      '.',
      '__tests__',
      'resources',
      'test-png.png'
    );
    const targetPath = path.join(profileFolder, storeFilename);
    fs.copyFileSync(testFilePath, targetPath);
    user.image = storeFilename;
    await user.save();
    await deleteUser(user.id, { token });
    expect(fs.existsSync(targetPath)).toBe(false);
  });

  it('deletes hoax attachment from storage and database when delete user request sent from authorized', async () => {
    const savedUser = await addUser();
    const token = await auth({
      auth: credentails
    });

    const storeFilename = 'profile-image-user1';
    const testFilePath = path.join(
      '.',
      '__tests__',
      'resources',
      'test-png.png'
    );
    const targetPath = path.join(attachmentFolder, storeFilename);
    fs.copyFileSync(testFilePath, targetPath);

    const storeAttachment = await FileAttachment.create({
      filename: storeFilename
    });

    await request(app)
      .post('/api/1.0/hoaxes')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hoax content', fileAttachment: storeAttachment.id });

    await deleteUser(savedUser.id, {
      token: token
    });
    const storeAttachmentAfterDelete = await FileAttachment.findOne({
      where: { id: storeAttachment.id }
    });

    expect(storeAttachmentAfterDelete).toBeNull();
    expect(fs.existsSync(targetPath)).toBe(false);
  });
});
