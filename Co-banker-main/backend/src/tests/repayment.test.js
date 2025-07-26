const request = require('supertest');
const app = require('../server');
const { supabase } = require('../config/database');

// Mock Supabase for testing
jest.mock('../config/database', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          order: jest.fn(),
        })),
        order: jest.fn(),
        range: jest.fn(),
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

describe('Repayment Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/repayments', () => {
    const validRepaymentData = {
      loan_id: 'test-loan-id',
      amount: 1000,
      payment_method: 'cash',
      payment_date: '2024-01-15',
      notes: 'Monthly installment payment',
    };

    test('should create a new repayment with valid data', async () => {
      const mockLoan = { 
        loan_id: 'test-loan-id', 
        principal_amount: 10000,
        outstanding_amount: 8000,
        repayment_status: 'ongoing'
      };
      const mockRepayment = { repayment_id: 'test-repayment-id', ...validRepaymentData };
      
      // Mock loan exists and is active
      supabase.from().select().eq().single.mockResolvedValueOnce({ data: mockLoan, error: null });
      
      // Mock repayment creation
      supabase.from().insert().select().single.mockResolvedValue({ data: mockRepayment, error: null });

      const response = await request(app)
        .post('/api/v1/repayments')
        .send(validRepaymentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRepayment);
    });

    test('should return 400 for invalid repayment data', async () => {
      const invalidData = { ...validRepaymentData };
      delete invalidData.loan_id; // Remove required field

      const response = await request(app)
        .post('/api/v1/repayments')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    test('should return 404 for non-existent loan', async () => {
      supabase.from().select().eq().single.mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116' } 
      });

      const response = await request(app)
        .post('/api/v1/repayments')
        .send(validRepaymentData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Loan not found');
    });

    test('should return 400 for completed loan', async () => {
      const completedLoan = { 
        loan_id: 'test-loan-id', 
        repayment_status: 'completed' 
      };
      
      supabase.from().select().eq().single.mockResolvedValue({ data: completedLoan, error: null });

      const response = await request(app)
        .post('/api/v1/repayments')
        .send(validRepaymentData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Loan is already completed');
    });

    test('should return 400 for overpayment', async () => {
      const mockLoan = { 
        loan_id: 'test-loan-id', 
        outstanding_amount: 500,
        repayment_status: 'ongoing'
      };
      
      supabase.from().select().eq().single.mockResolvedValue({ data: mockLoan, error: null });

      const overpaymentData = { ...validRepaymentData, amount: 1000 }; // More than outstanding

      const response = await request(app)
        .post('/api/v1/repayments')
        .send(overpaymentData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Payment amount exceeds outstanding balance');
    });

    test('should handle database errors', async () => {
      const mockLoan = { 
        loan_id: 'test-loan-id', 
        outstanding_amount: 8000,
        repayment_status: 'ongoing'
      };
      
      supabase.from().select().eq().single.mockResolvedValueOnce({ data: mockLoan, error: null });
      supabase.from().insert().select().single.mockResolvedValue({ 
        data: null, 
        error: new Error('Database error') 
      });

      const response = await request(app)
        .post('/api/v1/repayments')
        .send(validRepaymentData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Server error');
    });
  });

  describe('GET /api/v1/repayments', () => {
    test('should get all repayments', async () => {
      const mockRepayments = [
        { repayment_id: '1', loan_id: 'loan-1', amount: 1000, payment_method: 'cash' },
        { repayment_id: '2', loan_id: 'loan-2', amount: 1500, payment_method: 'bank_transfer' },
      ];

      supabase.from().select().order.mockResolvedValue({ data: mockRepayments, error: null });

      const response = await request(app)
        .get('/api/v1/repayments')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRepayments);
    });

    test('should filter repayments by loan_id', async () => {
      const mockRepayments = [
        { repayment_id: '1', loan_id: 'loan-1', amount: 1000 },
      ];

      supabase.from().select().eq().order.mockResolvedValue({ data: mockRepayments, error: null });

      const response = await request(app)
        .get('/api/v1/repayments?loan_id=loan-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRepayments);
    });

    test('should handle pagination', async () => {
      const mockRepayments = [
        { repayment_id: '1', loan_id: 'loan-1', amount: 1000 },
      ];

      supabase.from().select().range().order.mockResolvedValue({ 
        data: mockRepayments, 
        error: null,
        count: 1 
      });

      const response = await request(app)
        .get('/api/v1/repayments?page=1&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRepayments);
      expect(response.body.pagination).toBeDefined();
    });

    test('should handle database errors when getting repayments', async () => {
      supabase.from().select().order.mockResolvedValue({ 
        data: null, 
        error: new Error('Database error') 
      });

      const response = await request(app)
        .get('/api/v1/repayments')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Server error');
    });
  });

  describe('GET /api/v1/repayments/:id', () => {
    test('should get repayment by ID', async () => {
      const mockRepayment = { 
        repayment_id: 'test-id', 
        loan_id: 'loan-1', 
        amount: 1000,
        loans: { 
          member_id: 'member-1',
          members: { name: 'John Doe' }
        }
      };

      supabase.from().select().eq().single.mockResolvedValue({ data: mockRepayment, error: null });

      const response = await request(app)
        .get('/api/v1/repayments/test-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRepayment);
    });

    test('should return 404 for non-existent repayment', async () => {
      supabase.from().select().eq().single.mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116' } 
      });

      const response = await request(app)
        .get('/api/v1/repayments/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Repayment not found');
    });
  });

  describe('PUT /api/v1/repayments/:id', () => {
    test('should update repayment with valid data', async () => {
      const updateData = { 
        payment_method: 'bank_transfer', 
        notes: 'Updated payment method' 
      };
      const mockRepayment = { repayment_id: 'test-id', ...updateData };

      supabase.from().update().eq().select().single.mockResolvedValue({ data: mockRepayment, error: null });

      const response = await request(app)
        .put('/api/v1/repayments/test-id')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRepayment);
    });

    test('should return 400 for invalid update data', async () => {
      const invalidData = { amount: -100 }; // Invalid negative amount

      const response = await request(app)
        .put('/api/v1/repayments/test-id')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('must be greater than 0');
    });

    test('should handle database errors when updating repayment', async () => {
      const updateData = { notes: 'Updated notes' };
      
      supabase.from().update().eq().select().single.mockResolvedValue({ 
        data: null, 
        error: new Error('Database error') 
      });

      const response = await request(app)
        .put('/api/v1/repayments/test-id')
        .send(updateData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Server error');
    });
  });
});
