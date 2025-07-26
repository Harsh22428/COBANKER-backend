const request = require('supertest');
const app = require('../server');
const { supabase } = require('../config/database');

// Mock Supabase for testing
jest.mock('../config/database', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        or: jest.fn(() => ({
          maybeSingle: jest.fn(),
        })),
        eq: jest.fn(() => ({
          single: jest.fn(),
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
      delete: jest.fn(() => ({
        eq: jest.fn(),
      })),
    })),
  },
}));

// Mock authentication middleware
jest.mock('../middleware/authMiddleware', () => ({
  authenticateToken: (req, res, next) => {
    req.user = {
      id: 'test-user-id',
      role: 'admin',
      bank_id: 'test-bank-id',
      branch_id: 'test-branch-id',
    };
    next();
  },
}));

describe('Customer Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/customers', () => {
    const validCustomerData = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      address: '123 Main St, City, State',
      date_of_birth: '1990-01-01',
      gender: 'male',
      occupation: 'Engineer',
      annual_income: 50000,
      bank_id: 'test-bank-id',
      branch_id: 'test-branch-id',
    };

    test('should create a new customer with valid data', async () => {
      const mockCustomer = { customer_id: 'test-customer-id', ...validCustomerData };
      
      supabase.from().select().or().maybeSingle.mockResolvedValue({ data: null, error: null });
      supabase.from().insert().select().single.mockResolvedValue({ data: mockCustomer, error: null });

      const response = await request(app)
        .post('/api/v1/customers')
        .send(validCustomerData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCustomer);
    });

    test('should return 400 for invalid customer data', async () => {
      const invalidData = { ...validCustomerData };
      delete invalidData.name; // Remove required field

      const response = await request(app)
        .post('/api/v1/customers')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    test('should return 409 for duplicate phone/email', async () => {
      supabase.from().select().or().maybeSingle.mockResolvedValue({ 
        data: { customer_id: 'existing-customer' }, 
        error: null 
      });

      const response = await request(app)
        .post('/api/v1/customers')
        .send(validCustomerData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Phone or email already exists.');
    });

    test('should handle database errors', async () => {
      supabase.from().select().or().maybeSingle.mockResolvedValue({ data: null, error: null });
      supabase.from().insert().select().single.mockResolvedValue({ 
        data: null, 
        error: new Error('Database error') 
      });

      const response = await request(app)
        .post('/api/v1/customers')
        .send(validCustomerData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Server error');
    });
  });

  describe('GET /api/v1/customers', () => {
    test('should get all customers', async () => {
      const mockCustomers = [
        { customer_id: '1', name: 'John Doe', email: 'john@example.com' },
        { customer_id: '2', name: 'Jane Smith', email: 'jane@example.com' },
      ];

      supabase.from().select().order.mockResolvedValue({ data: mockCustomers, error: null });

      const response = await request(app)
        .get('/api/v1/customers')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCustomers);
    });

    test('should handle database errors when getting customers', async () => {
      supabase.from().select().order.mockResolvedValue({ 
        data: null, 
        error: new Error('Database error') 
      });

      const response = await request(app)
        .get('/api/v1/customers')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Server error');
    });
  });

  describe('GET /api/v1/customers/:id', () => {
    test('should get customer by ID', async () => {
      const mockCustomer = { customer_id: 'test-id', name: 'John Doe', email: 'john@example.com' };

      supabase.from().select().eq().single.mockResolvedValue({ data: mockCustomer, error: null });

      const response = await request(app)
        .get('/api/v1/customers/test-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCustomer);
    });

    test('should return 404 for non-existent customer', async () => {
      supabase.from().select().eq().single.mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116' } 
      });

      const response = await request(app)
        .get('/api/v1/customers/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Customer not found');
    });
  });
});
