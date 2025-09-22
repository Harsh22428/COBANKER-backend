const { logger } = require('../utils/logger');

/**
 * Validates all required environment variables and configurations
 * for production deployment
 */
const validateProductionConfig = () => {
  const errors = [];
  const warnings = [];

  // Required environment variables
  const requiredEnvVars = {
    'NODE_ENV': 'Environment type (development/production)',
    'PORT': 'Server port number',
    'JWT_SECRET': 'JWT secret key for token signing',
    'SUPABASE_URL': 'Supabase project URL',
    'SUPABASE_ANON_KEY': 'Supabase anonymous key',
    'SUPABASE_SERVICE_ROLE_KEY': 'Supabase service role key',
  };

  // Check required environment variables
  Object.entries(requiredEnvVars).forEach(([key, description]) => {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key} (${description})`);
    }
  });

  // Validate JWT_SECRET strength in production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      warnings.push('JWT_SECRET should be at least 32 characters long for production');
    }
  }

  // Validate PORT
  if (process.env.PORT) {
    const port = parseInt(process.env.PORT);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push('PORT must be a valid number between 1 and 65535');
    }
  }

  // Validate SUPABASE_URL format
  if (process.env.SUPABASE_URL) {
    try {
      const url = new URL(process.env.SUPABASE_URL);
      if (!url.hostname.includes('supabase')) {
        warnings.push('SUPABASE_URL does not appear to be a valid Supabase URL');
      }
    } catch (error) {
      errors.push('SUPABASE_URL is not a valid URL format');
    }
  }

  // Optional but recommended environment variables
  const recommendedEnvVars = {
    'LOG_LEVEL': 'Logging level (info, warn, error)',
    'RATE_LIMIT_WINDOW_MS': 'Rate limiting window in milliseconds',
    'RATE_LIMIT_MAX_REQUESTS': 'Maximum requests per window',
    'API_VERSION': 'API version (default: v1)',
  };

  Object.entries(recommendedEnvVars).forEach(([key, description]) => {
    if (!process.env[key]) {
      warnings.push(`Recommended environment variable not set: ${key} (${description})`);
    }
  });

  // Validate dependencies
  try {
    require('@supabase/supabase-js');
    require('express');
    require('jsonwebtoken');
    require('bcryptjs');
    require('joi');
    require('winston');
    require('cors');
    require('helmet');
    require('compression');
    require('express-rate-limit');
    require('express-slow-down');
    require('dotenv');
    require('uuid');
    require('moment');
  } catch (error) {
    errors.push(`Missing required dependency: ${error.message}`);
  }

  // Log results
  if (errors.length > 0) {
    logger.error('Production configuration validation failed:');
    errors.forEach(error => logger.error(`  - ${error}`));
    throw new Error(`Configuration validation failed: ${errors.length} errors found`);
  }

  if (warnings.length > 0) {
    logger.warn('Production configuration warnings:');
    warnings.forEach(warning => logger.warn(`  - ${warning}`));
  }

  logger.info('Production configuration validation passed');
  return true;
};

/**
 * Validates database connection
 */
const validateDatabaseConnection = async () => {
  try {
    const { supabase } = require('./database');
    
    // Test database connection with a simple query
    const { data, error } = await supabase
      .from('todos')
      .select('count')
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Database connection failed: ${error.message}`);
    }

    logger.info('Database connection validated successfully');
    return true;
  } catch (error) {
    logger.error('Database connection validation failed:', error.message);
    throw error;
  }
};

/**
 * Validates all critical systems before starting the server
 */
const validateSystemHealth = async () => {
  try {
    logger.info('Starting system health validation...');
    
    // Validate configuration
    validateProductionConfig();
    
    // Validate database connection
    await validateDatabaseConnection();
    
    logger.info('System health validation completed successfully');
    return true;
  } catch (error) {
    logger.error('System health validation failed:', error.message);
    throw error;
  }
};

/**
 * Runtime health check for monitoring
 */
const healthCheck = async () => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || 'unknown',
  };

  try {
    // Check database connectivity
    const { supabase } = require('./database');
    const { error } = await supabase
      .from('todos')
      .select('count')
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      health.status = 'unhealthy';
      health.database = 'disconnected';
    } else {
      health.database = 'connected';
    }
  } catch (error) {
    health.status = 'unhealthy';
    health.database = 'error';
    health.error = error.message;
  }

  return health;
};

module.exports = {
  validateProductionConfig,
  validateDatabaseConnection,
  validateSystemHealth,
  healthCheck,
};
