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

describe('Member Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/members', () => {
    const validMemberData = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      address: '123 Main St, City, State',
      date_of_birth: '1990-01-01',
      gender: 'male',
      occupation: 'Engineer',
      annual_income: 50000,
      membership_type: 'regular',
      share_amount: 1000,
      nominee_name: 'Jane Doe',
      nominee_relationship: 'spouse',
      bank_id: 'test-bank-id',
      branch_id: 'test-branch-id',
    };

    test('should create a new member with valid data', async () => {
      const mockMember = { member_id: 'test-member-id', ...validMemberData };
      
      supabase.from().select().or().maybeSingle.mockResolvedValue({ data: null, error: null });
      supabase.from().insert().select().single.mockResolvedValue({ data: mockMember, error: null });

      const response = await request(app)
        .post('/api/v1/members')
        .send(validMemberData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockMember);
    });

    test('should return 400 for invalid member data', async () => {
      const invalidData = { ...validMemberData };
      delete invalidData.name; // Remove required field

      const response = await request(app)
        .post('/api/v1/members')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    test('should return 409 for duplicate phone/email', async () => {
      supabase.from().select().or().maybeSingle.mockResolvedValue({ 
        data: { member_id: 'existing-member' }, 
        error: null 
      });

      const response = await request(app)
        .post('/api/v1/members')
        .send(validMemberData)
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
        .post('/api/v1/members')
        .send(validMemberData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Server error');
    });
  });

  describe('GET /api/v1/members', () => {
    test('should get all members', async () => {
      const mockMembers = [
        { member_id: '1', name: 'John Doe', email: 'john@example.com', status: 'active' },
        { member_id: '2', name: 'Jane Smith', email: 'jane@example.com', status: 'active' },
      ];

      supabase.from().select().order.mockResolvedValue({ data: mockMembers, error: null });

      const response = await request(app)
        .get('/api/v1/members')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockMembers);
    });

    test('should filter members by status', async () => {
      const activeMembers = [
        { member_id: '1', name: 'John Doe', status: 'active' },
      ];

      supabase.from().select().eq().order.mockResolvedValue({ data: activeMembers, error: null });

      const response = await request(app)
        .get('/api/v1/members?status=active')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(activeMembers);
    });

    test('should handle pagination', async () => {
      const mockMembers = [
        { member_id: '1', name: 'John Doe' },
      ];

      supabase.from().select().range().order.mockResolvedValue({ 
        data: mockMembers, 
        error: null,
        count: 1 
      });

      const response = await request(app)
        .get('/api/v1/members?page=1&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockMembers);
      expect(response.body.pagination).toBeDefined();
    });

    test('should handle database errors when getting members', async () => {
      supabase.from().select().order.mockResolvedValue({ 
        data: null, 
        error: new Error('Database error') 
      });

      const response = await request(app)
        .get('/api/v1/members')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Server error');
    });
  });

  describe('GET /api/v1/members/:id', () => {
    test('should get member by ID', async () => {
      const mockMember = { 
        member_id: 'test-id', 
        name: 'John Doe', 
        email: 'john@example.com',
        branches: { name: 'Main Branch' },
        banks: { name: 'Test Bank' }
      };

      supabase.from().select().eq().single.mockResolvedValue({ data: mockMember, error: null });

      const response = await request(app)
        .get('/api/v1/members/test-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockMember);
    });

    test('should return 404 for non-existent member', async () => {
      supabase.from().select().eq().single.mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116' } 
      });

      const response = await request(app)
        .get('/api/v1/members/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Member not found');
    });
  });

  describe('PUT /api/v1/members/:id', () => {
    test('should update member with valid data', async () => {
      const updateData = { 
        phone: '+9876543210', 
        address: '456 New St, City, State',
        annual_income: 60000 
      };
      const mockMember = { member_id: 'test-id', ...updateData };

      supabase.from().update().eq().select().single.mockResolvedValue({ data: mockMember, error: null });

      const response = await request(app)
        .put('/api/v1/members/test-id')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockMember);
    });

    test('should return 400 for invalid update data', async () => {
      const invalidData = { email: 'invalid-email' }; // Invalid email format

      const response = await request(app)
        .put('/api/v1/members/test-id')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('valid email');
    });

    test('should handle database errors when updating member', async () => {
      const updateData = { phone: '+9876543210' };
      
      supabase.from().update().eq().select().single.mockResolvedValue({ 
        data: null, 
        error: new Error('Database error') 
      });

      const response = await request(app)
        .put('/api/v1/members/test-id')
        .send(updateData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Server error');
    });
  });

  describe('DELETE /api/v1/members/:id', () => {
    test('should delete member', async () => {
      supabase.from().delete().eq.mockResolvedValue({ error: null });

      const response = await request(app)
        .delete('/api/v1/members/test-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Member deleted successfully');
    });

    test('should handle database errors when deleting member', async () => {
      supabase.from().delete().eq.mockResolvedValue({ error: new Error('Database error') });

      const response = await request(app)
        .delete('/api/v1/members/test-id')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Server error');
    });
  });
});
