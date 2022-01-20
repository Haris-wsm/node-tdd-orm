const profiles = require('../config');

const dbConfig = {};

Object.keys(profiles).forEach((profile) => {
  dbConfig[profile] = { ...profiles[profile].database };
});

module.exports = dbConfig;

// module.exports = {
//   development: {
//     username: 'my-db-user',
//     password: 'db-p4ss',
//     database: 'hoaxify',
//     host: 'localhost',
//     dialect: 'sqlite',
//     storage: './database.sqlite'
//   },
//   staging: {
//     username: 'my-db-user',
//     password: 'db-p4ss',
//     database: 'hoaxify',
//     host: 'localhost',
//     dialect: 'sqlite',
//     storage: './staging.sqlite'
//   }
// };
