const request = require('supertest');
const app = require('../src/app');
const fs = require('fs');
const path = require('path');

const config = require('config');

const { uploadDir, profileDir, attachmentDir } = config;
const profileFolder = path.join('.', uploadDir, profileDir);
const attachmentFolder = path.join('.', uploadDir, attachmentDir);

describe('Profile Images', () => {
  const copyFile = () => {
    const filePath = path.join('.', '__tests__', 'resources', 'test-png.png');
    const storeFileName = 'test-file';
    const targetPat = path.join(profileFolder, storeFileName);

    fs.copyFileSync(filePath, targetPat);
    return storeFileName;
  };
  it('returns 404 when file not found', async () => {
    const response = await request(app).get('/images/123456');
    expect(response.status).toBe(404);
  });

  it('returns 200 ok when file exist', async () => {
    const storeFileName = copyFile();
    const response = await request(app).get(`/images/${storeFileName}`);
    expect(response.status).toBe(200);
  });

  it('returns caches for 1 years in response', async () => {
    const storeFileName = copyFile();
    const response = await request(app).get(`/images/${storeFileName}`);

    const oneYearsInSecond = 365 * 24 * 60 * 60;
    expect(response.header['cache-control']).toContain(
      `max-age=${oneYearsInSecond}`
    );
  });
});
describe('Attachment', () => {
  const copyFile = () => {
    const filePath = path.join('.', '__tests__', 'resources', 'test-png.png');
    const storeFileName = 'test-file';
    const targetPath = path.join(attachmentFolder, storeFileName);

    fs.copyFileSync(filePath, targetPath);
    return storeFileName;
  };
  it('returns 404 when file not found', async () => {
    const response = await request(app).get('/attachments/123456');
    expect(response.status).toBe(404);
  });

  it('returns 200 ok when file exist', async () => {
    const storeFileName = copyFile();
    const response = await request(app).get(`/attachments/${storeFileName}`);
    expect(response.status).toBe(200);
  });

  it('returns caches for 1 years in response', async () => {
    const storeFileName = copyFile();
    const response = await request(app).get(`/attachments/${storeFileName}`);

    const oneYearsInSecond = 365 * 24 * 60 * 60;
    expect(response.header['cache-control']).toContain(
      `max-age=${oneYearsInSecond}`
    );
  });
});
