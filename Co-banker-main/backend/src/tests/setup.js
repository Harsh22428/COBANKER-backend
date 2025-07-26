// Test setup file for COBANKER Backend
require('dotenv').config({ path: '.env.test' });

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock Supabase client
jest.mock('../config/database', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          order: jest.fn(),
          range: jest.fn(),
          maybeSingle: jest.fn(),
        })),
        or: jest.fn(() => ({
          maybeSingle: jest.fn(),
        })),
        order: jest.fn(),
        range: jest.fn(),
        lte: jest.fn(),
        gte: jest.fn(),
        in: jest.fn(),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(),
      })),
    })),
  },
  supabaseAdmin: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          order: jest.fn(),
        })),
        order: jest.fn(),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
      })),
    })),
  },
}));

// Mock Winston logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock authentication middleware
jest.mock('../middleware/authMiddleware', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = global.testUser;
    next();
  }),
  authorizeRoles: jest.fn((...roles) => (req, res, next) => {
    req.user = global.testUser;
    next();
  }),
  authorizeBranch: jest.fn((req, res, next) => {
    req.user = global.testUser;
    next();
  }),
  authorizeBank: jest.fn((req, res, next) => {
    req.user = global.testUser;
    next();
  }),
}));

// Mock validation middleware
jest.mock('../middleware/validationMiddleware', () => ({
  validateRequest: jest.fn((schema) => (req, res, next) => {
    next();
  }),
}));

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-jwt-token'),
  verify: jest.fn(() => ({
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'admin',
    bank_id: 'test-bank-id',
    branch_id: 'test-branch-id',
  })),
}));

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn(() => Promise.resolve('hashed-password')),
  compare: jest.fn(() => Promise.resolve(true)),
}));

// Mock moment
jest.mock('moment', () => {
  const moment = jest.requireActual('moment');
  return {
    ...moment,
    default: moment,
  };
});

// Set up global test variables
global.testUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'admin',
  bank_id: 'test-bank-id',
  branch_id: 'test-branch-id',
  name: 'Test User',
  phone: '+1234567890',
  status: 'active',
};

global.testCustomer = {
  customer_id: 'test-customer-id',
  name: 'John Doe',
  email: 'john.doe@example.com',
  phone: '+1234567890',
  address: '123 Main St, City, State',
  status: 'active',
  bank_id: 'test-bank-id',
  branch_id: 'test-branch-id',
};

global.testMember = {
  member_id: 'test-member-id',
  name: 'Jane Smith',
  email: 'jane.smith@example.com',
  phone: '+1234567891',
  status: 'active',
  membership_type: 'regular',
  share_amount: 1000,
  bank_id: 'test-bank-id',
  branch_id: 'test-branch-id',
};

global.testAccount = {
  id: 'test-account-id',
  account_number: 'CB12345678',
  customer_id: 'test-customer-id',
  account_type: 'savings',
  balance: 5000,
  status: 'active',
  bank_id: 'test-bank-id',
  branch_id: 'test-branch-id',
};

global.testLoan = {
  loan_id: 'test-loan-id',
  member_id: 'test-member-id',
  loan_type: 'personal',
  principal_amount: 10000,
  interest_rate: 12.5,
  tenure_months: 24,
  outstanding_amount: 8000,
  repayment_status: 'ongoing',
  bank_id: 'test-bank-id',
  branch_id: 'test-branch-id',
};

// Set up test database connection mock
beforeAll(() => {
  // Mock database connection
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  // Clean up after all tests
  jest.clearAllMocks();
});

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Clean up after each test
  jest.restoreAllMocks();
});
