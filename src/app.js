const express = require('express');
const UserRouter = require('./user/UserRouter');
const AuthenticationRouter = require('./auth/AuthenticationRouters');
const HoaxRouter = require('./hoax/HoaxRouter');

const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');
const ErrorHandler = require('./error/ErrorHandler');
const tokenAuthentication = require('./middleware/tokenAuthentication');

const FileService = require('./file/FileService');
const config = require('config');
const path = require('path');

const { uploadDir, profileDir } = config;
const profileDirectory = path.join('.', uploadDir, profileDir);

const ONE_YEAR_IN_MILLI = 365 * 24 * 60 * 60 * 1000;

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    fallbackLng: 'en',
    lng: 'en',
    ns: ['translation'],
    defaultNS: 'translation',
    backend: {
      loadPath: './locals/{{lng}}/{{ns}}.json'
    },
    detection: {
      lookupHeader: 'accept-language'
    }
  });

FileService.createFolders();

const app = express();
app.use(middleware.handle(i18next));

app.use(express.json({ limit: '3mb' }));

app.use(
  '/images',
  express.static(profileDirectory, { maxAge: ONE_YEAR_IN_MILLI })
);

app.use(tokenAuthentication);
app.use('/api/1.0', UserRouter);
app.use('/api/1.0', AuthenticationRouter);
app.use('/api/1.0', HoaxRouter);

app.use(ErrorHandler);

module.exports = app;
