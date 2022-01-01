const express = require('express');
const router = express.Router();
const UserService = require('../user/UserService');
const AuthenticationException = require('./AuthenticationException');
const ForbiddenException = require('./ForbiddenException');
const { check, validationResult } = require('express-validator');
const ValidationErrors = require('../error/ValidationException');

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

    res.send({ id: user.id, username: user.username });
  }
);

module.exports = router;
