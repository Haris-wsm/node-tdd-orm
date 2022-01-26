module.exports = {
  database: {
    database: 'hoaxify',
    username: 'postgres',
    password: 'postgres',
    dialect: 'postgres',
    // storage: './staging.sqlite',
    host: 'localhost',
    logging: false
  },
  mail: {
    host: 'localhost',
    port: Math.floor(Math.random() * 2000) + 10000,
    tls: {
      rejectUnauthorized: false
    }
  },
  uploadDir: 'uploads-staging',
  profileDir: 'profile'
};
