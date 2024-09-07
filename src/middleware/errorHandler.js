const { logger } = require('../utils/logger');

exports.errorHandler = (err, req, res, next) => {
  logger.error(err.stack);

  res.status(500).json({
    message: 'An unexpected error occurred',
    error: process.env.NODE_ENV === 'production' ? {} : err
  });
};
