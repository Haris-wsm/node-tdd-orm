const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');

const UserService = require('./UserService');
const ValidationErrors = require('../error/ValidationException');
const pagination = require('../middleware/pagination');
const ForbiddenException = require('../error/ForbiddenException');

const basicAuthentication = require('../middleware/basicAuthentication');

router.post(
  '/users',
  check('username')
    .notEmpty()
    .withMessage('username_null')
    .bail()
    .isLength({ min: 4, max: 32 })
    .withMessage('username_size'),
  check('email')
    .notEmpty()
    .withMessage('email_null')
    .bail()
    .isEmail()
    .withMessage('email_invalid')
    .bail()
    .custom(async (email) => {
      const user = await UserService.findByEmail(email);
      if (user) {
        throw new Error('email_inuse');
      }
    }),
  check('password')
    .notEmpty()
    .withMessage('password_null')
    .bail()
    .isLength({ min: 6 })
    .withMessage('password_size')
    .bail()
    .matches(/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9]).*$/)
    .withMessage('password_pattern'),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationErrors(errors.array()));
    }

    try {
      await UserService.save(req.body);
      res.send({ message: req.t('user_create_success') });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/users/token/:token', async (req, res, next) => {
  const token = req.params.token;
  try {
    await UserService.activate(token);
    res.send({ message: req.t('account_activation_success') });
  } catch (err) {
    next(err);
  }
});

router.get('/users', pagination, basicAuthentication, async (req, res) => {
  const autheticatedUser = req.authenticatedUser;

  const { page, size } = req.pagination;
  const users = await UserService.getUsers(page, size, autheticatedUser);
  res.send(users);
});

router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await UserService.getUser(req.params.id);
    res.send(user);
  } catch (error) {
    next(error);
  }
});

router.put('/users/:id', basicAuthentication, async (req, res, next) => {
  const autheticatedUser = req.authenticatedUser;

  if (!autheticatedUser || autheticatedUser.id != req.params.id) {
    return next(new ForbiddenException('unauthorized_user_update'));
  }

  await UserService.updateUser(req.params.id, req.body);
  return res.send();
});

module.exports = router;
