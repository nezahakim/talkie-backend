const { Pool } = require("pg");
const { Sequelize } = require("sequelize");
const { logger } = require("../utils/logger");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

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
