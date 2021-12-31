const nodemailer = require('nodemailer');
const config = require('config');

const mailConfig = config.get('mail');
const transpoter = nodemailer.createTransport({
  ...mailConfig
});

module.exports = transpoter;
