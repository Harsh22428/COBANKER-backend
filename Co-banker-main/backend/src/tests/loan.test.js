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

describe('Loan Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/loans', () => {
    const validLoanData = {
      member_id: 'test-member-id',
      loan_type: 'personal',
      principal_amount: 10000,
      interest_rate: 12.5,
      tenure_months: 24,
      purpose: 'Home renovation',
      collateral_type: 'property',
      collateral_value: 50000,
      guarantor_name: 'John Guarantor',
      guarantor_phone: '+1234567890',
    };

    test('should create a new loan with valid data', async () => {
      const mockMember = { member_id: 'test-member-id', status: 'active' };
      const mockLoan = { loan_id: 'test-loan-id', ...validLoanData };
      
      // Mock member exists and is active
      supabase.from().select().eq().single.mockResolvedValueOnce({ data: mockMember, error: null });
      
      // Mock no active loans
      supabase.from().select().eq().eq.mockResolvedValueOnce({ data: [], error: null });
      
      // Mock loan creation
      supabase.from().insert().select().single.mockResolvedValue({ data: mockLoan, error: null });

      const response = await request(app)
        .post('/api/v1/loans')
        .send(validLoanData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockLoan);
    });

    test('should return 400 for invalid loan data', async () => {
      const invalidData = { ...validLoanData };
      delete invalidData.member_id; // Remove required field

      const response = await request(app)
        .post('/api/v1/loans')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    test('should return 404 for non-existent member', async () => {
      supabase.from().select().eq().single.mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116' } 
      });

      const response = await request(app)
        .post('/api/v1/loans')
        .send(validLoanData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Member not found');
    });

    test('should return 400 for inactive member', async () => {
      const inactiveMember = { member_id: 'test-member-id', status: 'inactive' };
      
      supabase.from().select().eq().single.mockResolvedValue({ data: inactiveMember, error: null });

      const response = await request(app)
        .post('/api/v1/loans')
        .send(validLoanData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Member is not active');
    });

    test('should return 400 for member with ongoing loans', async () => {
      const mockMember = { member_id: 'test-member-id', status: 'active' };
      const activeLoans = [{ loan_id: 'existing-loan-id' }];
      
      supabase.from().select().eq().single.mockResolvedValueOnce({ data: mockMember, error: null });
      supabase.from().select().eq().eq.mockResolvedValueOnce({ data: activeLoans, error: null });

      const response = await request(app)
        .post('/api/v1/loans')
        .send(validLoanData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Member has ongoing loans');
    });
  });

  describe('GET /api/v1/loans', () => {
    test('should get all loans', async () => {
      const mockLoans = [
        { loan_id: '1', member_id: 'member-1', principal_amount: 10000 },
        { loan_id: '2', member_id: 'member-2', principal_amount: 15000 },
      ];

      supabase.from().select().order.mockResolvedValue({ data: mockLoans, error: null });

      const response = await request(app)
        .get('/api/v1/loans')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockLoans);
    });

    test('should filter loans by member_id', async () => {
      const mockLoans = [
        { loan_id: '1', member_id: 'member-1', principal_amount: 10000 },
      ];

      supabase.from().select().eq().order.mockResolvedValue({ data: mockLoans, error: null });

      const response = await request(app)
        .get('/api/v1/loans?member_id=member-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockLoans);
    });

    test('should handle database errors when getting loans', async () => {
      supabase.from().select().order.mockResolvedValue({ 
        data: null, 
        error: new Error('Database error') 
      });

      const response = await request(app)
        .get('/api/v1/loans')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Server error');
    });
  });

  describe('GET /api/v1/loans/:id', () => {
    test('should get loan by ID', async () => {
      const mockLoan = { 
        loan_id: 'test-id', 
        member_id: 'member-1', 
        principal_amount: 10000,
        members: { name: 'John Doe' }
      };

      supabase.from().select().eq().single.mockResolvedValue({ data: mockLoan, error: null });

      const response = await request(app)
        .get('/api/v1/loans/test-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockLoan);
    });

    test('should return 404 for non-existent loan', async () => {
      supabase.from().select().eq().single.mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116' } 
      });

      const response = await request(app)
        .get('/api/v1/loans/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Loan not found');
    });
  });

  describe('PUT /api/v1/loans/:id', () => {
    test('should update loan with valid data', async () => {
      const updateData = { interest_rate: 15.0, tenure_months: 36 };
      const mockLoan = { loan_id: 'test-id', ...updateData };

      supabase.from().update().eq().select().single.mockResolvedValue({ data: mockLoan, error: null });

      const response = await request(app)
        .put('/api/v1/loans/test-id')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockLoan);
    });

    test('should return 400 for invalid update data', async () => {
      const invalidData = { interest_rate: -5 }; // Invalid negative rate

      const response = await request(app)
        .put('/api/v1/loans/test-id')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('must be greater than or equal to 0');
    });
  });

  describe('DELETE /api/v1/loans/:id', () => {
    test('should delete loan', async () => {
      supabase.from().delete().eq.mockResolvedValue({ error: null });

      const response = await request(app)
        .delete('/api/v1/loans/test-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Loan deleted successfully');
    });

    test('should handle database errors when deleting loan', async () => {
      supabase.from().delete().eq.mockResolvedValue({ error: new Error('Database error') });

      const response = await request(app)
        .delete('/api/v1/loans/test-id')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Server error');
    });
  });
});
