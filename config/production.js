module.exports = {
  database: {
    database: 'hoaxify',
    password: 'db-p4ss',
    username: 'db-p4ss',
    dialect: 'sqlite',
    storage: './prod-db.sqlite',
    logging: false
  },
  mail: {
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
      user: 'kiara.wisozk55@ethereal.email',
      pass: 'PSkNHGxkfqV8H33pzS'
    }
  },
  uploadDir: 'uploads-productions',
  profileDir: 'profile'
};
