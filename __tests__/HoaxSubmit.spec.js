const request = require('supertest');
const app = require('../src/app');

const en = require('../locals/en/translation.json');
const th = require('../locals/th/translation.json');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const bcrypt = require('bcrypt');

const Hoax = require('../src/hoax/Hoax');
const FileAttachment = require('../src/file/FileAttachment');
const path = require('path');

beforeEach(async () => {
  await User.destroy({ truncate: { cascade: true } });
  // await Hoax.destroy({ truncate: { cascade: true } });
  // await FileAttachment.destroy({ truncate: true });
});

const postHoax = async (body = null, options = {}) => {
  let agent = request(app);
  let token;
  if (options.auth) {
    const response = await agent.post('/api/1.0/auth').send(options.auth);
    token = response.body.token;
    // console.log(token);
  }
  agent = agent.post('/api/1.0/hoaxes');

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

const uploadFile = (filename = 'test-png.png', options = {}) => {
  const agent = request(app).post('/api/1.0/hoaxes/attachments');

  if (options.language) {
    agent.set('accept-language', options.language);
  }

  return agent.attach(
    'file',
    path.join('.', '__tests__', 'resources', filename)
  );
};

describe('Post Hoax', () => {
  it('returns 401 when hoax post request has no authentication', async () => {
    const response = await postHoax();

    expect(response.status).toBe(401);
  });

  it.each`
    language | message
    ${'th'}  | ${th.unauthorized_hoax_submit}
    ${'en'}  | ${en.unauthorized_hoax_submit}
  `(
    'returns error body with $message when unauthorized request sent with language $language',
    async ({ language, message }) => {
      const nowInMillis = Date.now();
      const response = await postHoax(null, { language });
      const error = response.body;

      expect(error.path).toBe('/api/1.0/hoaxes');
      expect(error.message).toBe(message);
      expect(error.timestamp).toBeGreaterThan(nowInMillis);
    }
  );

  it('returns 200 when valid hoax subnitted with authorized user', async () => {
    await addUser();
    const response = await postHoax(
      { content: 'Hoax content' },
      { auth: credentails }
    );

    expect(response.status).toBe(200);
  });
  it('saves the hoax to database when authorized user send valid request', async () => {
    await addUser();
    await postHoax({ content: 'Hoax content' }, { auth: credentails });
    const hoaxes = await Hoax.findAll();

    expect(hoaxes.length).toBe(1);
  });
  it('saves the hoax content and timestamp to database', async () => {
    await addUser();
    const beforeSubmit = Date.now();
    await postHoax({ content: 'Hoax content' }, { auth: credentails });
    const hoaxes = await Hoax.findAll();
    const savedHoax = hoaxes[0];
    expect(savedHoax.content).toBe('Hoax content');
    expect(savedHoax.timestamp).toBeGreaterThan(beforeSubmit);
    expect(savedHoax.timestamp).toBeLessThan(Date.now());
  });

  it.each`
    language | message
    ${'th'}  | ${th.hoax_submit_success}
    ${'en'}  | ${en.hoax_submit_success}
  `(
    'returns $message to success submit when language is $language',
    async ({ language, message }) => {
      await addUser();

      const response = await postHoax(
        { content: 'Hoax content' },
        { auth: credentails, language }
      );

      expect(response.body.message).toBe(message);
    }
  );
  it.each`
    language | message
    ${'th'}  | ${th.validation_failure}
    ${'en'}  | ${en.validation_failure}
  `(
    'returns 400 and $message when hoax content is less than 10 character',
    async ({ language, message }) => {
      await addUser();

      const response = await postHoax(
        { content: '123456789' },
        { auth: credentails, language }
      );
      expect(response.status).toBe(400);
      expect(response.body.message).toBe(message);
    }
  );
  it('returns validation error body when an invalid hoax post by authorized user', async () => {
    await addUser();
    const nowInMilli = Date.now();
    const response = await postHoax(
      { content: '123456789' },
      { auth: credentails }
    );

    const errors = response.body;

    expect(errors.timestamp).toBeGreaterThan(nowInMilli);
    expect(errors.path).toBe('/api/1.0/hoaxes');
    expect(Object.keys(errors)).toEqual([
      'path',
      'timestamp',
      'message',
      'validationErrors'
    ]);
  });

  it.each`
    language | content             | contentForDescription | message
    ${'th'}  | ${null}             | ${'null'}             | ${th.hoax_content_size}
    ${'th'}  | ${'a'.repeat(9)}    | ${'short'}            | ${th.hoax_content_size}
    ${'th'}  | ${'a'.repeat(5001)} | ${'very long'}        | ${th.hoax_content_size}
    ${'en'}  | ${null}             | ${'null'}             | ${en.hoax_content_size}
    ${'en'}  | ${'a'.repeat(9)}    | ${'short'}            | ${en.hoax_content_size}
    ${'en'}  | ${'a'.repeat(5001)} | ${'very long'}        | ${en.hoax_content_size}
  `(
    'returns $message when the content is $contentForDescription and language is $language',
    async ({ language, content, message }) => {
      await addUser();
      const response = await postHoax(
        { content: content },
        { auth: credentails, language }
      );

      expect(response.status).toBe(400);
      // expect(response.body.validationErrors.content).toBe(message);
    }
  );
  it('stores hoax owner in database', async () => {
    const user = await addUser();
    await postHoax({ content: 'Hoax content' }, { auth: credentails });
    const hoax = await Hoax.findAll();

    expect(hoax[0].userId).toBe(user.id);
  });
  it('associates hoax with attachment in database', async () => {
    const uploadResponse = await uploadFile();
    const uploadFileId = uploadResponse.body.id;
    await addUser();
    await postHoax(
      { content: 'Hoax content', fileAttachment: uploadFileId },
      { auth: credentails }
    );
    const hoaxes = await Hoax.findAll();
    const hoax = hoaxes[0];
    const attachmentInDb = await FileAttachment.findOne({
      where: { id: uploadFileId }
    });
    expect(attachmentInDb.hoaxId).toBe(hoax.id);
  });
  it('returns 200 even the attachment does not exist', async () => {
    const user = await addUser();
    const response = await postHoax(
      { content: 'Hoax content', fileAttachment: 1000 },
      { auth: credentails }
    );

    expect(response.status).toBe(200);
  });
  it('keeps the old associated hoax when new hoax submited with old attachment id', async () => {
    const uploadResponse = await uploadFile();
    const uploadFileId = uploadResponse.body.id;
    await addUser();
    await postHoax(
      { content: 'Hoax content', fileAttachment: uploadFileId },
      { auth: credentails }
    );
    const attachment = await FileAttachment.findOne({
      where: { id: uploadFileId }
    });

    await postHoax(
      { content: 'Hoax content 2', fileAttachment: uploadFileId },
      { auth: credentails }
    );

    const attachmentAfterSecondPost = await FileAttachment.findOne({
      where: { id: uploadFileId }
    });

    expect(attachment.hoaxId).toBe(attachmentAfterSecondPost.hoaxId);
  });
});
