const transpoter = require('../config/emailTranspoter');
const nodemailer = require('nodemailer');
const logger = require('../shared/logger');
const sendAccountActivation = async (email, token) => {
  const info = await transpoter.sendMail({
    from: 'My App <info@my-app.com>',
    to: email,
    subject: 'Account Activation',
    html: `
    <div>
      <b>Please click below link to activate your account.</b>
    Token is ${token}
    </div>
    <div>
      <a href="http://localhost:8080/#/login?token=${token}">Activate</a>
    </div>
    `
  });

  logger.info('url:' + nodemailer.getTestMessageUrl(info));
};
const sendPasswordReset = async (email, token) => {
  const info = await transpoter.sendMail({
    from: 'My App <info@my-app.com>',
    to: email,
    subject: 'Password Reset',
    html: `
    <div>
      <b>Please click below link to reset ypur password</b>
    Token is ${token}
    </div>
    <div>
      <a href="http://localhost:8080/#/password-reset?token=${token}">Reset</a>
    </div>
    `
  });

  logger.info('url:' + nodemailer.getTestMessageUrl(info));
};

module.exports = { sendAccountActivation, sendPasswordReset };
