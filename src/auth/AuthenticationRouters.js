const express = require('express');
const router = express.Router();
const UserService = require('../user/UserService');
const AuthenticationException = require('./AuthenticationException');
const ForbiddenException = require('../error/ForbiddenException');
const { check, validationResult } = require('express-validator');
const TokenService = require('./TokenService');

const bcrypt = require('bcrypt');

router.post(
  '/auth',
  check('email')
    .notEmpty()
    .withMessage('email_null')
    .bail()
    .isEmail()
    .withMessage('email_invalid')
    .bail(),
  check('password').notEmpty().withMessage('password_null'),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AuthenticationException());
    }
    const { email, password } = req.body;
    const user = await UserService.findByEmail(email);

    if (!user) return next(new AuthenticationException());

    const match = await bcrypt.compare(password, user.password);
    if (!match) return next(new AuthenticationException());

    if (user.inactive) return next(new ForbiddenException());

    const token = await TokenService.createToken(user);

    res.send({
      id: user.id,
      username: user.username,
      image: user.image,
      token
    });
  }
);

router.post('/logout', async (req, res, next) => {
  const authoriztion = req.headers.authorization;

  if (authoriztion) {
    const token = authoriztion.substring(7);
    await TokenService.deleteToken(token);
  }

  res.send();
});

module.exports = router;
