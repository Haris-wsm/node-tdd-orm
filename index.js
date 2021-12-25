const app = require('./src/app');
const sequelize = require('./src/config/database');

sequelize.sync();

app.listen(process.env.PORT || 3000, () => {
  console.log('app is running');
});
