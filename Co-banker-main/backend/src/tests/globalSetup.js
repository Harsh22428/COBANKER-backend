// Global setup for COBANKER Backend tests
require('dotenv').config({ path: '.env.test' });

module.exports = async () => {
  console.log('Setting up COBANKER Backend test environment...');

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_jwt_secret_key_for_cobanker_testing_12345';
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test_anon_key_12345';

  console.log('Test environment configured');
  console.log('Mock services initialized');
  console.log('Ready to run COBANKER Backend tests');
};
