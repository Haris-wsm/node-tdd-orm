const express = require('express');
const router = express.Router();

const User = require('./User');
const UserService = require('./UserService');
const bcrypt = require('bcrypt');

router.post('/users', async (req, res) => {
  await UserService.save(req.body);
  res.send({ message: 'User created' });
});

module.exports = router;
