const { logger } = require('../utils/logger');

// Joi-based validation middleware
const validateRequest = (schema) => {
  return (req, res, next) => {
    if (!schema) {
      return next();
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      logger.warn('Validation failed:', {
        url: req.originalUrl,
        method: req.method,
        errors: error.details,
        body: req.body,
        params: req.params,
        query: req.query,
      });

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value,
        })),
      });
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

module.exports = {
  validateRequest,
}; 