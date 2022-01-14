const express = require('express');
const UserRouter = require('./user/UserRouter');
const AuthenticationRouter = require('./auth/AuthenticationRouters');
const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');
const ErrorHandler = require('./error/ErrorHandler');
const tokenAuthentication = require('./middleware/tokenAuthentication');

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

const app = express();
app.use(middleware.handle(i18next));

app.use(express.json());

app.use(tokenAuthentication);
app.use('/api/1.0', UserRouter);
app.use('/api/1.0', AuthenticationRouter);

app.use(ErrorHandler);

module.exports = app;
