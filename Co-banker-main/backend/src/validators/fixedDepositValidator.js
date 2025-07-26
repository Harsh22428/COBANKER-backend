const Joi = require('joi');

// Fixed Deposit creation validation schema
const fdCreateSchema = Joi.object({
  customer_id: Joi.string().uuid().required().messages({
    'string.empty': 'Customer ID is required',
    'string.uuid': 'Customer ID must be a valid UUID',
    'any.required': 'Customer ID is required',
  }),
  
  fd_type: Joi.string().valid('regular', 'senior_citizen', 'cumulative', 'non_cumulative').required().messages({
    'string.empty': 'Fixed Deposit type is required',
    'any.only': 'Fixed Deposit type must be one of: regular, senior_citizen, cumulative, non_cumulative',
    'any.required': 'Fixed Deposit type is required',
  }),
  
  principal_amount: Joi.number().min(1000).max(10000000).required().messages({
    'number.base': 'Principal amount must be a number',
    'number.min': 'Principal amount must be at least ₹1,000',
    'number.max': 'Principal amount cannot exceed ₹1,00,00,000',
    'any.required': 'Principal amount is required',
  }),
  
  interest_rate: Joi.number().min(0.1).max(50).precision(2).required().messages({
    'number.base': 'Interest rate must be a number',
    'number.min': 'Interest rate must be at least 0.1%',
    'number.max': 'Interest rate cannot exceed 50%',
    'any.required': 'Interest rate is required',
  }),
  
  tenure_months: Joi.number().integer().min(6).max(120).required().messages({
    'number.base': 'Tenure must be a number',
    'number.integer': 'Tenure must be a whole number',
    'number.min': 'Tenure must be at least 6 months',
    'number.max': 'Tenure cannot exceed 120 months (10 years)',
    'any.required': 'Tenure is required',
  }),
  
  nominee_name: Joi.string().max(100).optional().messages({
    'string.max': 'Nominee name cannot exceed 100 characters',
  }),
  
  nominee_relationship: Joi.string().max(50).optional().messages({
    'string.max': 'Nominee relationship cannot exceed 50 characters',
  }),
  
  auto_renewal: Joi.boolean().default(false).messages({
    'boolean.base': 'Auto renewal must be true or false',
  }),
  
  description: Joi.string().max(500).optional().messages({
    'string.max': 'Description cannot exceed 500 characters',
  }),
});

// Fixed Deposit update validation schema
const fdUpdateSchema = Joi.object({
  interest_rate: Joi.number().min(0.1).max(50).precision(2).optional().messages({
    'number.base': 'Interest rate must be a number',
    'number.min': 'Interest rate must be at least 0.1%',
    'number.max': 'Interest rate cannot exceed 50%',
  }),
  
  status: Joi.string().valid('active', 'matured', 'premature_closed', 'renewed', 'pending').optional().messages({
    'any.only': 'Status must be one of: active, matured, premature_closed, renewed, pending',
  }),
  
  nominee_name: Joi.string().max(100).optional().messages({
    'string.max': 'Nominee name cannot exceed 100 characters',
  }),
  
  nominee_relationship: Joi.string().max(50).optional().messages({
    'string.max': 'Nominee relationship cannot exceed 50 characters',
  }),
  
  auto_renewal: Joi.boolean().optional().messages({
    'boolean.base': 'Auto renewal must be true or false',
  }),
  
  description: Joi.string().max(500).optional().messages({
    'string.max': 'Description cannot exceed 500 characters',
  }),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

// Fixed Deposit query validation schema
const fdQuerySchema = Joi.object({
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
  
  status: Joi.string().valid('active', 'matured', 'premature_closed', 'renewed', 'pending').optional().messages({
    'any.only': 'Status must be one of: active, matured, premature_closed, renewed, pending',
  }),
  
  fd_type: Joi.string().valid('regular', 'senior_citizen', 'cumulative', 'non_cumulative').optional().messages({
    'any.only': 'FD type must be one of: regular, senior_citizen, cumulative, non_cumulative',
  }),
  
  customer_id: Joi.string().uuid().optional().messages({
    'string.uuid': 'Customer ID must be a valid UUID',
  }),
  
  branch_id: Joi.string().uuid().optional().messages({
    'string.uuid': 'Branch ID must be a valid UUID',
  }),
  
  min_amount: Joi.number().min(0).optional().messages({
    'number.base': 'Minimum amount must be a number',
    'number.min': 'Minimum amount cannot be negative',
  }),
  
  max_amount: Joi.number().min(0).optional().messages({
    'number.base': 'Maximum amount must be a number',
    'number.min': 'Maximum amount cannot be negative',
  }),
  
  from_date: Joi.date().iso().optional().messages({
    'date.format': 'From date must be in ISO format (YYYY-MM-DD)',
  }),
  
  to_date: Joi.date().iso().min(Joi.ref('from_date')).optional().messages({
    'date.format': 'To date must be in ISO format (YYYY-MM-DD)',
    'date.min': 'To date must be after from date',
  }),
});

// Fixed Deposit premature closure validation schema
const fdPrematureClosureSchema = Joi.object({
  penalty_rate: Joi.number().min(0).max(10).default(1).messages({
    'number.base': 'Penalty rate must be a number',
    'number.min': 'Penalty rate cannot be negative',
    'number.max': 'Penalty rate cannot exceed 10%',
  }),
  
  reason: Joi.string().max(500).required().messages({
    'string.empty': 'Reason for premature closure is required',
    'string.max': 'Reason cannot exceed 500 characters',
    'any.required': 'Reason for premature closure is required',
  }),
});

// Fixed Deposit renewal validation schema
const fdRenewalSchema = Joi.object({
  new_tenure_months: Joi.number().integer().min(6).max(120).required().messages({
    'number.base': 'New tenure must be a number',
    'number.integer': 'New tenure must be a whole number',
    'number.min': 'New tenure must be at least 6 months',
    'number.max': 'New tenure cannot exceed 120 months (10 years)',
    'any.required': 'New tenure is required',
  }),
  
  new_interest_rate: Joi.number().min(0.1).max(50).precision(2).optional().messages({
    'number.base': 'New interest rate must be a number',
    'number.min': 'New interest rate must be at least 0.1%',
    'number.max': 'New interest rate cannot exceed 50%',
  }),
  
  additional_amount: Joi.number().min(0).default(0).messages({
    'number.base': 'Additional amount must be a number',
    'number.min': 'Additional amount cannot be negative',
  }),
});

module.exports = {
  fdCreateSchema,
  fdUpdateSchema,
  fdQuerySchema,
  fdPrematureClosureSchema,
  fdRenewalSchema,
};
