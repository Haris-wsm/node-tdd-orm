const request = require('supertest');
const app = require('../src/app');
const path = require('path');

const FileAttachment = require('../src/file/FileAttachment');
const fs = require('fs');
const config = require('config');
const en = require('../locals/en/translation.json');
const th = require('../locals/th/translation.json');

const { uploadDir, attachmentDir } = config;

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

beforeEach(async () => {
  await FileAttachment.destroy({ truncate: true });
});

describe('Upload File for hoax', () => {
  it('returns 200 ok when upload successful upload', async () => {
    const response = await uploadFile();
    expect(response.status).toBe(200);
  });

  it('saves dynamicFilename, uplaodDate as attachment object in database', async () => {
    const nowInMillis = Date.now();
    await uploadFile();

    const attachments = await FileAttachment.findAll();
    const attachment = attachments[0];
    expect(attachment.filename).not.toBe('test-png.png');
    expect(attachment.uploadDate.getTime()).toBeGreaterThan(nowInMillis);
  });

  it('saves file to attachment folder', async () => {
    await uploadFile();

    const attachments = await FileAttachment.findAll();
    const attachment = attachments[0];

    const filePath = path.join(
      '.',
      uploadDir,
      attachmentDir,
      attachment.filename
    );

    expect(fs.existsSync(filePath)).toBe(true);
  });

  it.each`
    file              | fileType
    ${'test-png.png'} | ${'image/png'}
    ${'test-png'}     | ${'image/png'}
    ${'test-gif.gif'} | ${'image/gif'}
    ${'test-jpg.jpg'} | ${'image/jpeg'}
    ${'test-pdf.pdf'} | ${'application/pdf'}
    ${'test-txt.txt'} | ${null}
  `(
    'saves fileType as $fileType in attachment object whent $file is uploaded',
    async ({ file, fileType }) => {
      await uploadFile(file);

      const attachments = await FileAttachment.findAll();
      const attachment = attachments[0];

      expect(attachment.fileType).toBe(fileType);
    }
  );
  it.each`
    file              | fileExtension
    ${'test-png.png'} | ${'png'}
    ${'test-png'}     | ${'png'}
    ${'test-gif.gif'} | ${'gif'}
    ${'test-jpg.jpg'} | ${'jpg'}
    ${'test-pdf.pdf'} | ${'pdf'}
    ${'test-txt.txt'} | ${null}
  `(
    'saves filename with extension with $fileExtension in attachment object and stored object when $file is uploaded',
    async ({ file, fileExtension }) => {
      await uploadFile(file);

      const attachments = await FileAttachment.findAll();
      const attachment = attachments[0];
      if (file === 'test-txt.txt') {
        expect(attachment.filename.endsWith('txt')).toBe(false);
      } else {
        expect(attachment.filename.endsWith(fileExtension)).toBe(true);
      }
      const filePath = path.join(
        '.',
        uploadDir,
        attachmentDir,
        attachment.filename
      );

      expect(fs.existsSync(filePath)).toBe(true);
    }
  );

  it('returns 400 when uploaded file size is bigger than 5mb', async () => {
    const fiveMB = 5 * 1024 * 1024;
    const filePath = path.join('.', '__tests__', 'resources', 'random-file');

    fs.writeFileSync(filePath, 'a'.repeat(fiveMB) + 'a');

    const response = await uploadFile('random-file');
    expect(response.status).toBe(400);
    fs.unlinkSync(filePath);
  });
  it('returns 200 when uploaded file size is 5mb', async () => {
    const fiveMB = 5 * 1024 * 1024;
    const filePath = path.join('.', '__tests__', 'resources', 'random-file');

    fs.writeFileSync(filePath, 'a'.repeat(fiveMB));

    const response = await uploadFile('random-file');
    expect(response.status).toBe(200);
    fs.unlinkSync(filePath);
  });

  it.each`
    language | message
    ${'en'}  | ${en.attachment_size_limit}
    ${'th'}  | ${th.attachment_size_limit}
  `(
    'returns $message when attachment file is bigger than 5mb',
    async ({ language, message }) => {
      const fiveMB = 5 * 1024 * 1024;
      const filePath = path.join('.', '__tests__', 'resources', 'random-file');

      fs.writeFileSync(filePath, 'a'.repeat(fiveMB) + 'a');
      const nowInMillis = Date.now();
      const response = await uploadFile('random-file', { language });

      const error = response.body;
      expect(error.path).toBe('/api/1.0/hoaxes/attachments');
      expect(error.message).toBe(message);
      expect(error.timestamp).toBeGreaterThan(nowInMillis);
      fs.unlinkSync(filePath);
    }
  );
  it('returns attachment id in response', async () => {
    const response = await uploadFile();
    expect(Object.keys(response.body)).toEqual(['id']);
  });
});
