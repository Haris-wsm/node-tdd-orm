const nodemailer = require('nodemailer');
const nodmailerStub = require('nodemailer-stub');
const transpoter = nodemailer.createTransport(nodmailerStub.stubTransport);

module.exports = transpoter;
