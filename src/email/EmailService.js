const transpoter = require('../config/emailTranspoter');

const sendAccountActivation = async (email, token) => {
  await transpoter.sendMail({
    from: 'My App <info@my-app.com>',
    to: email,
    subject: 'Account Activation',
    html: `Token is ${token}`
  });
};

module.exports = { sendAccountActivation };
