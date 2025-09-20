const Joi = require('joi');

// Share creation validation schema
const shareCreateSchema = Joi.object({
  member_id: Joi.string().uuid().required().messages({
    'string.empty': 'Member ID is required',
    'string.uuid': 'Member ID must be a valid UUID',
    'any.required': 'Member ID is required',
  }),
  
  share_type: Joi.string().valid('ordinary', 'preference', 'bonus', 'rights').required().messages({
    'string.empty': 'Share type is required',
    'any.only': 'Share type must be one of: ordinary, preference, bonus, rights',
    'any.required': 'Share type is required',
  }),
  
  number_of_shares: Joi.number().integer().min(1).max(10000).required().messages({
    'number.base': 'Number of shares must be a number',
    'number.integer': 'Number of shares must be a whole number',
    'number.min': 'Number of shares must be at least 1',
    'number.max': 'Number of shares cannot exceed 10,000',
    'any.required': 'Number of shares is required',
  }),
  
  share_value: Joi.number().min(1).max(100000).required().messages({
    'number.base': 'Share value must be a number',
    'number.min': 'Share value must be at least ₹1',
    'number.max': 'Share value cannot exceed ₹1,00,000',
    'any.required': 'Share value is required',
  }),
  
  certificate_number: Joi.string().max(50).optional().messages({
    'string.max': 'Certificate number cannot exceed 50 characters',
  }),
  
  description: Joi.string().max(500).optional().messages({
    'string.max': 'Description cannot exceed 500 characters',
  }),
});

// Share update validation schema
const shareUpdateSchema = Joi.object({
  share_type: Joi.string().valid('ordinary', 'preference', 'bonus', 'rights').optional().messages({
    'any.only': 'Share type must be one of: ordinary, preference, bonus, rights',
  }),
  
  status: Joi.string().valid('active', 'transferred', 'redeemed', 'suspended', 'pending').optional().messages({
    'any.only': 'Status must be one of: active, transferred, redeemed, suspended, pending',
  }),
  
  certificate_number: Joi.string().max(50).optional().messages({
    'string.max': 'Certificate number cannot exceed 50 characters',
  }),
  
  description: Joi.string().max(500).optional().messages({
    'string.max': 'Description cannot exceed 500 characters',
  }),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

// Share transfer validation schema
const shareTransferSchema = Joi.object({
  from_member_id: Joi.string().uuid().required().messages({
    'string.empty': 'From member ID is required',
    'string.uuid': 'From member ID must be a valid UUID',
    'any.required': 'From member ID is required',
  }),
  
  to_member_id: Joi.string().uuid().required().messages({
    'string.empty': 'To member ID is required',
    'string.uuid': 'To member ID must be a valid UUID',
    'any.required': 'To member ID is required',
  }),
  
  number_of_shares: Joi.number().integer().min(1).max(10000).required().messages({
    'number.base': 'Number of shares must be a number',
    'number.integer': 'Number of shares must be a whole number',
    'number.min': 'Number of shares must be at least 1',
    'number.max': 'Number of shares cannot exceed 10,000',
    'any.required': 'Number of shares is required',
  }),
  
  transfer_price: Joi.number().min(0).max(10000000).required().messages({
    'number.base': 'Transfer price must be a number',
    'number.min': 'Transfer price cannot be negative',
    'number.max': 'Transfer price cannot exceed ₹1,00,00,000',
    'any.required': 'Transfer price is required',
  }),
  
  transfer_reason: Joi.string().min(10).max(500).required().messages({
    'string.empty': 'Transfer reason is required',
    'string.min': 'Transfer reason must be at least 10 characters',
    'string.max': 'Transfer reason cannot exceed 500 characters',
    'any.required': 'Transfer reason is required',
  }),
}).custom((value, helpers) => {
  if (value.from_member_id === value.to_member_id) {
    return helpers.error('custom.sameMember');
  }
  return value;
}).messages({
  'custom.sameMember': 'From member and to member cannot be the same',
});

// Share query validation schema
const shareQuerySchema = Joi.object({
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
  
  status: Joi.string().valid('active', 'transferred', 'redeemed', 'suspended', 'pending').optional().messages({
    'any.only': 'Status must be one of: active, transferred, redeemed, suspended, pending',
  }),
  
  share_type: Joi.string().valid('ordinary', 'preference', 'bonus', 'rights').optional().messages({
    'any.only': 'Share type must be one of: ordinary, preference, bonus, rights',
  }),
  
  member_id: Joi.string().uuid().optional().messages({
    'string.uuid': 'Member ID must be a valid UUID',
  }),
  
  branch_id: Joi.string().uuid().optional().messages({
    'string.uuid': 'Branch ID must be a valid UUID',
  }),
  
  min_shares: Joi.number().integer().min(0).optional().messages({
    'number.base': 'Minimum shares must be a number',
    'number.integer': 'Minimum shares must be a whole number',
    'number.min': 'Minimum shares cannot be negative',
  }),
  
  max_shares: Joi.number().integer().min(0).optional().messages({
    'number.base': 'Maximum shares must be a number',
    'number.integer': 'Maximum shares must be a whole number',
    'number.min': 'Maximum shares cannot be negative',
  }),
  
  from_date: Joi.date().iso().optional().messages({
    'date.format': 'From date must be in ISO format (YYYY-MM-DD)',
  }),
  
  to_date: Joi.date().iso().min(Joi.ref('from_date')).optional().messages({
    'date.format': 'To date must be in ISO format (YYYY-MM-DD)',
    'date.min': 'To date must be after from date',
  }),
});

// Share transaction query validation schema
const shareTransactionQuerySchema = Joi.object({
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
  
  member_id: Joi.string().uuid().optional().messages({
    'string.uuid': 'Member ID must be a valid UUID',
  }),
  
  transaction_type: Joi.string().valid('purchase', 'transfer', 'redemption', 'dividend', 'bonus_issue').optional().messages({
    'any.only': 'Transaction type must be one of: purchase, transfer, redemption, dividend, bonus_issue',
  }),
  
  from_date: Joi.date().iso().optional().messages({
    'date.format': 'From date must be in ISO format (YYYY-MM-DD)',
  }),
  
  to_date: Joi.date().iso().min(Joi.ref('from_date')).optional().messages({
    'date.format': 'To date must be in ISO format (YYYY-MM-DD)',
    'date.min': 'To date must be after from date',
  }),
});

// Share dividend distribution validation schema
const shareDividendSchema = Joi.object({
  dividend_rate: Joi.number().min(0).max(100).precision(2).required().messages({
    'number.base': 'Dividend rate must be a number',
    'number.min': 'Dividend rate cannot be negative',
    'number.max': 'Dividend rate cannot exceed 100%',
    'any.required': 'Dividend rate is required',
  }),
  
  dividend_year: Joi.number().integer().min(2000).max(2100).required().messages({
    'number.base': 'Dividend year must be a number',
    'number.integer': 'Dividend year must be a whole number',
    'number.min': 'Dividend year must be at least 2000',
    'number.max': 'Dividend year cannot exceed 2100',
    'any.required': 'Dividend year is required',
  }),
  
  announcement_date: Joi.date().iso().default(() => new Date().toISOString()).messages({
    'date.format': 'Announcement date must be in ISO format (YYYY-MM-DD)',
  }),
  
  payment_date: Joi.date().iso().min('now').required().messages({
    'date.format': 'Payment date must be in ISO format (YYYY-MM-DD)',
    'date.min': 'Payment date must be in the future',
    'any.required': 'Payment date is required',
  }),
  
  description: Joi.string().max(500).optional().messages({
    'string.max': 'Description cannot exceed 500 characters',
  }),
});

module.exports = {
  shareCreateSchema,
  shareUpdateSchema,
  shareTransferSchema,
  shareQuerySchema,
  shareTransactionQuerySchema,
  shareDividendSchema,
};
