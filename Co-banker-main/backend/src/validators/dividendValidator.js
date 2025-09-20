const Joi = require('joi');

// Dividend creation validation schema
const dividendCreateSchema = Joi.object({
  dividend_year: Joi.number().integer().min(2000).max(2100).required().messages({
    'number.base': 'Dividend year must be a number',
    'number.integer': 'Dividend year must be a whole number',
    'number.min': 'Dividend year must be at least 2000',
    'number.max': 'Dividend year cannot exceed 2100',
    'any.required': 'Dividend year is required',
  }),
  
  dividend_type: Joi.string().valid('annual', 'interim', 'bonus', 'special').required().messages({
    'string.empty': 'Dividend type is required',
    'any.only': 'Dividend type must be one of: annual, interim, bonus, special',
    'any.required': 'Dividend type is required',
  }),
  
  dividend_rate: Joi.number().min(0).max(100).precision(2).required().messages({
    'number.base': 'Dividend rate must be a number',
    'number.min': 'Dividend rate cannot be negative',
    'number.max': 'Dividend rate cannot exceed 100%',
    'any.required': 'Dividend rate is required',
  }),
  
  record_date: Joi.date().iso().required().messages({
    'date.format': 'Record date must be in ISO format (YYYY-MM-DD)',
    'any.required': 'Record date is required',
  }),
  
  payment_date: Joi.date().iso().min('now').required().messages({
    'date.format': 'Payment date must be in ISO format (YYYY-MM-DD)',
    'date.min': 'Payment date must be in the future',
    'any.required': 'Payment date is required',
  }),
  
  description: Joi.string().max(500).optional().messages({
    'string.max': 'Description cannot exceed 500 characters',
  }),
  
  board_resolution_number: Joi.string().max(100).optional().messages({
    'string.max': 'Board resolution number cannot exceed 100 characters',
  }),
});

// Dividend update validation schema
const dividendUpdateSchema = Joi.object({
  dividend_rate: Joi.number().min(0).max(100).precision(2).optional().messages({
    'number.base': 'Dividend rate must be a number',
    'number.min': 'Dividend rate cannot be negative',
    'number.max': 'Dividend rate cannot exceed 100%',
  }),
  
  status: Joi.string().valid('declared', 'approved', 'paid', 'cancelled', 'pending').optional().messages({
    'any.only': 'Status must be one of: declared, approved, paid, cancelled, pending',
  }),
  
  payment_date: Joi.date().iso().optional().messages({
    'date.format': 'Payment date must be in ISO format (YYYY-MM-DD)',
  }),
  
  description: Joi.string().max(500).optional().messages({
    'string.max': 'Description cannot exceed 500 characters',
  }),
  
  board_resolution_number: Joi.string().max(100).optional().messages({
    'string.max': 'Board resolution number cannot exceed 100 characters',
  }),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

// Dividend query validation schema
const dividendQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    'number.base': 'Page must be a number',
    'number.integer': 'Page must be a whole number',
    'number.min': 'Page must be at least 1',
  }),
  
  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    'number.base': 'Limit must be a number',
    'number.integer': 'Limit must be a whole number',
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit cannot exceed 100',
  }),
  
  dividend_year: Joi.number().integer().min(2000).max(2100).optional().messages({
    'number.base': 'Dividend year must be a number',
    'number.integer': 'Dividend year must be a whole number',
    'number.min': 'Dividend year must be at least 2000',
    'number.max': 'Dividend year cannot exceed 2100',
  }),
  
  dividend_type: Joi.string().valid('annual', 'interim', 'bonus', 'special').optional().messages({
    'any.only': 'Dividend type must be one of: annual, interim, bonus, special',
  }),
  
  status: Joi.string().valid('declared', 'approved', 'paid', 'cancelled', 'pending').optional().messages({
    'any.only': 'Status must be one of: declared, approved, paid, cancelled, pending',
  }),
  
  from_date: Joi.date().iso().optional().messages({
    'date.format': 'From date must be in ISO format (YYYY-MM-DD)',
  }),
  
  to_date: Joi.date().iso().min(Joi.ref('from_date')).optional().messages({
    'date.format': 'To date must be in ISO format (YYYY-MM-DD)',
    'date.min': 'To date must be after from date',
  }),
});

// Dividend cancellation validation schema
const dividendCancelSchema = Joi.object({
  reason: Joi.string().min(10).max(500).required().messages({
    'string.empty': 'Cancellation reason is required',
    'string.min': 'Cancellation reason must be at least 10 characters',
    'string.max': 'Cancellation reason cannot exceed 500 characters',
    'any.required': 'Cancellation reason is required',
  }),
});

// Dividend distribution validation schema
const dividendDistributionSchema = Joi.object({
  member_id: Joi.string().uuid().optional().messages({
    'string.uuid': 'Member ID must be a valid UUID',
  }),
  
  payment_method: Joi.string().valid('bank_transfer', 'cash', 'cheque', 'digital_wallet').default('bank_transfer').messages({
    'any.only': 'Payment method must be one of: bank_transfer, cash, cheque, digital_wallet',
  }),
  
  notes: Joi.string().max(500).optional().messages({
    'string.max': 'Notes cannot exceed 500 characters',
  }),
});

// Dividend statistics validation schema
const dividendStatsSchema = Joi.object({
  year: Joi.number().integer().min(2000).max(2100).optional().messages({
    'number.base': 'Year must be a number',
    'number.integer': 'Year must be a whole number',
    'number.min': 'Year must be at least 2000',
    'number.max': 'Year cannot exceed 2100',
  }),
  
  period: Joi.string().valid('month', 'quarter', 'year', 'all').default('year').messages({
    'any.only': 'Period must be one of: month, quarter, year, all',
  }),
  
  dividend_type: Joi.string().valid('annual', 'interim', 'bonus', 'special').optional().messages({
    'any.only': 'Dividend type must be one of: annual, interim, bonus, special',
  }),
});

module.exports = {
  dividendCreateSchema,
  dividendUpdateSchema,
  dividendQuerySchema,
  dividendCancelSchema,
  dividendDistributionSchema,
  dividendStatsSchema,
};
