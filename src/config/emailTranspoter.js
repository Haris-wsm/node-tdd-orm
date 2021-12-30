const nodemailer = require('nodemailer');

const transpoter = nodemailer.createTransport({
  host: 'localhost',
  port: 8587,
  tls: {
    rejectUnauthorized: false
  }
});

module.exports = transpoter;
