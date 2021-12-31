const app = require('./src/app');
const sequelize = require('./src/config/database');
const User = require('./src/user/User');

const addUser = async (activeUserCount, inactiveUserCount = 0) => {
  for (let i = 0; i < activeUserCount + inactiveUserCount; i++) {
    await User.create({
      username: `user${i + 1}`,
      email: `user${i + 1}@mail.com`,
      inactive: i >= activeUserCount
    });
  }
};
sequelize.sync({ force: true }).then(async () => {
  addUser(25);
});

app.listen(process.env.PORT || 3000, () => {
  console.log('app is running');
});
