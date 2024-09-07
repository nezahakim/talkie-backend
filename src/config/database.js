// const { Pool } = require('pg');
// const { logger } = require('../utils/logger');

// const pool = new Pool({
//   user: process.env.DB_USER,
//   host: process.env.DB_HOST,
//   database: process.env.DB_NAME,
//   password: process.env.DB_PASSWORD,
//   port: process.env.DB_PORT,
// });

// const connectDB = async () => {
//   try {
//     await pool.connect();
//     logger.info('Connected to PostgreSQL database');
//   } catch (error) {
//     logger.error('Error connecting to database:', error);
//     process.exit(1);
//   }
// };

// module.exports = { pool, connectDB };

const { Pool } = require("pg");
const { Sequelize } = require("sequelize");
const { logger } = require("../utils/logger");

// const pool = new Pool({
//   user: process.env.DB_USER,
//   host: process.env.DB_HOST,
//   database: process.env.DB_NAME,
//   password: process.env.DB_PASSWORD,
//   port: process.env.DB_PORT,
// });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// const sequelize = new Sequelize(
//   process.env.DB_NAME,
//   process.env.DB_USER,
//   process.env.DB_PASSWORD,
//   {
//     host: process.env.DB_HOST,
//     dialect: "postgres",
//     logging: (msg) => logger.debug(msg),
//   },
// );

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: (msg) => logger.debug(msg),
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // Adjust based on your SSL settings
    },
  },
});

const connectDB = async () => {
  try {
    await pool.connect();
    await sequelize.authenticate();
    logger.info("Connected to PostgreSQL database");
  } catch (error) {
    logger.error("Error connecting to database:", error);
    process.exit(1);
  }
};

module.exports = { pool, sequelize, connectDB };
