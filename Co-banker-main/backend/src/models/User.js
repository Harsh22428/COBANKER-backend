const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../config/database');
const { logger } = require('../utils/logger');

// User roles
const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  BANK_MANAGER: 'bank_manager',
  BRANCH_MANAGER: 'branch_manager',
  CASHIER: 'cashier',
  LOAN_OFFICER: 'loan_officer',
  ACCOUNTANT: 'accountant',
  BOARD_MEMBER: 'board_member',
  AUDITOR: 'auditor',
  CUSTOMER_SERVICE: 'customer_service',
};

// User statuses
const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  PENDING_APPROVAL: 'pending_approval',
  LOCKED: 'locked',
};

// Permission categories
const PERMISSIONS = {
  // Account management
  ACCOUNT_CREATE: 'account:create',
  ACCOUNT_READ: 'account:read',
  ACCOUNT_UPDATE: 'account:update',
  ACCOUNT_DELETE: 'account:delete',
  
  // Member management
  MEMBER_CREATE: 'member:create',
  MEMBER_READ: 'member:read',
  MEMBER_UPDATE: 'member:update',
  MEMBER_DELETE: 'member:delete',
  
  // Loan management
  LOAN_CREATE: 'loan:create',
  LOAN_READ: 'loan:read',
  LOAN_UPDATE: 'loan:update',
  LOAN_APPROVE: 'loan:approve',
  LOAN_DELETE: 'loan:delete',
  
  // Transaction management
  TRANSACTION_CREATE: 'transaction:create',
  TRANSACTION_READ: 'transaction:read',
  TRANSACTION_UPDATE: 'transaction:update',
  
  // Share management
  SHARE_CREATE: 'share:create',
  SHARE_READ: 'share:read',
  SHARE_UPDATE: 'share:update',
  SHARE_TRANSFER: 'share:transfer',
  
  // Dividend management
  DIVIDEND_DECLARE: 'dividend:declare',
  DIVIDEND_APPROVE: 'dividend:approve',
  DIVIDEND_DISTRIBUTE: 'dividend:distribute',
  
  // Reports and analytics
  REPORTS_VIEW: 'reports:view',
  REPORTS_EXPORT: 'reports:export',
  ANALYTICS_VIEW: 'analytics:view',
  
  // System administration
  USER_MANAGE: 'user:manage',
  BANK_MANAGE: 'bank:manage',
  BRANCH_MANAGE: 'branch:manage',
  SYSTEM_CONFIG: 'system:config',
};

// Role-based permissions mapping
const ROLE_PERMISSIONS = {
  [USER_ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [USER_ROLES.ADMIN]: [
    PERMISSIONS.ACCOUNT_CREATE, PERMISSIONS.ACCOUNT_READ, PERMISSIONS.ACCOUNT_UPDATE,
    PERMISSIONS.MEMBER_CREATE, PERMISSIONS.MEMBER_READ, PERMISSIONS.MEMBER_UPDATE,
    PERMISSIONS.LOAN_CREATE, PERMISSIONS.LOAN_READ, PERMISSIONS.LOAN_UPDATE, PERMISSIONS.LOAN_APPROVE,
    PERMISSIONS.TRANSACTION_CREATE, PERMISSIONS.TRANSACTION_READ, PERMISSIONS.TRANSACTION_UPDATE,
    PERMISSIONS.SHARE_CREATE, PERMISSIONS.SHARE_READ, PERMISSIONS.SHARE_UPDATE, PERMISSIONS.SHARE_TRANSFER,
    PERMISSIONS.DIVIDEND_DECLARE, PERMISSIONS.DIVIDEND_APPROVE, PERMISSIONS.DIVIDEND_DISTRIBUTE,
    PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_EXPORT, PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.USER_MANAGE, PERMISSIONS.BRANCH_MANAGE,
  ],
  [USER_ROLES.BANK_MANAGER]: [
    PERMISSIONS.ACCOUNT_CREATE, PERMISSIONS.ACCOUNT_READ, PERMISSIONS.ACCOUNT_UPDATE,
    PERMISSIONS.MEMBER_CREATE, PERMISSIONS.MEMBER_READ, PERMISSIONS.MEMBER_UPDATE,
    PERMISSIONS.LOAN_CREATE, PERMISSIONS.LOAN_READ, PERMISSIONS.LOAN_UPDATE, PERMISSIONS.LOAN_APPROVE,
    PERMISSIONS.TRANSACTION_READ, PERMISSIONS.SHARE_READ, PERMISSIONS.SHARE_UPDATE,
    PERMISSIONS.REPORTS_VIEW, PERMISSIONS.ANALYTICS_VIEW,
  ],
  [USER_ROLES.BRANCH_MANAGER]: [
    PERMISSIONS.ACCOUNT_CREATE, PERMISSIONS.ACCOUNT_READ, PERMISSIONS.ACCOUNT_UPDATE,
    PERMISSIONS.MEMBER_CREATE, PERMISSIONS.MEMBER_READ, PERMISSIONS.MEMBER_UPDATE,
    PERMISSIONS.LOAN_CREATE, PERMISSIONS.LOAN_READ, PERMISSIONS.LOAN_UPDATE,
    PERMISSIONS.TRANSACTION_CREATE, PERMISSIONS.TRANSACTION_READ,
    PERMISSIONS.SHARE_READ, PERMISSIONS.REPORTS_VIEW,
  ],
  [USER_ROLES.CASHIER]: [
    PERMISSIONS.ACCOUNT_READ, PERMISSIONS.MEMBER_READ,
    PERMISSIONS.TRANSACTION_CREATE, PERMISSIONS.TRANSACTION_READ,
  ],
  [USER_ROLES.LOAN_OFFICER]: [
    PERMISSIONS.ACCOUNT_READ, PERMISSIONS.MEMBER_READ,
    PERMISSIONS.LOAN_CREATE, PERMISSIONS.LOAN_READ, PERMISSIONS.LOAN_UPDATE,
    PERMISSIONS.REPORTS_VIEW,
  ],
  [USER_ROLES.ACCOUNTANT]: [
    PERMISSIONS.ACCOUNT_READ, PERMISSIONS.MEMBER_READ,
    PERMISSIONS.TRANSACTION_READ, PERMISSIONS.LOAN_READ,
    PERMISSIONS.SHARE_READ, PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_EXPORT,
  ],
  [USER_ROLES.BOARD_MEMBER]: [
    PERMISSIONS.DIVIDEND_DECLARE, PERMISSIONS.DIVIDEND_APPROVE,
    PERMISSIONS.REPORTS_VIEW, PERMISSIONS.ANALYTICS_VIEW,
  ],
  [USER_ROLES.AUDITOR]: [
    PERMISSIONS.ACCOUNT_READ, PERMISSIONS.MEMBER_READ, PERMISSIONS.LOAN_READ,
    PERMISSIONS.TRANSACTION_READ, PERMISSIONS.SHARE_READ,
    PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_EXPORT, PERMISSIONS.ANALYTICS_VIEW,
  ],
  [USER_ROLES.CUSTOMER_SERVICE]: [
    PERMISSIONS.ACCOUNT_READ, PERMISSIONS.MEMBER_READ,
    PERMISSIONS.TRANSACTION_READ,
  ],
};

// Validation schemas
const userValidationSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).max(100).required(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
  role: Joi.string().valid(...Object.values(USER_ROLES)).required(),
  bank_id: Joi.string().uuid().required(),
  branch_id: Joi.string().uuid().optional(),
  employee_id: Joi.string().max(50).optional(),
  department: Joi.string().max(100).optional(),
  designation: Joi.string().max(100).optional(),
  reporting_manager: Joi.string().uuid().optional(),
  permissions: Joi.array().items(Joi.string()).optional(),
});

const userUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
  role: Joi.string().valid(...Object.values(USER_ROLES)),
  status: Joi.string().valid(...Object.values(USER_STATUS)),
  branch_id: Joi.string().uuid(),
  employee_id: Joi.string().max(50),
  department: Joi.string().max(100),
  designation: Joi.string().max(100),
  reporting_manager: Joi.string().uuid(),
  permissions: Joi.array().items(Joi.string()),
});

class User {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.email = data.email;
    this.password_hash = data.password_hash;
    this.name = data.name;
    this.phone = data.phone;
    this.role = data.role;
    this.bank_id = data.bank_id;
    this.branch_id = data.branch_id;
    this.employee_id = data.employee_id;
    this.department = data.department;
    this.designation = data.designation;
    this.reporting_manager = data.reporting_manager;
    this.permissions = data.permissions || ROLE_PERMISSIONS[data.role] || [];
    this.status = data.status || USER_STATUS.PENDING_APPROVAL;
    this.last_login = data.last_login;
    this.login_attempts = data.login_attempts || 0;
    this.locked_until = data.locked_until;
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
  }

  // Validate user data
  validate() {
    const { error, value } = userValidationSchema.validate(this, { allowUnknown: true });
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }
    return value;
  }

  // Hash password
  static async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Compare password
  async comparePassword(password) {
    return await bcrypt.compare(password, this.password_hash);
  }

  // Generate JWT token
  generateToken() {
    return jwt.sign(
      {
        id: this.id,
        email: this.email,
        role: this.role,
        bank_id: this.bank_id,
        branch_id: this.branch_id,
        permissions: this.permissions,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
  }

  // Create new user
  static async create(userData) {
    try {
      const user = new User(userData);
      const validatedData = user.validate();

      // Check if email already exists
      const { data: existingUser, error: existingError } = await supabase
        .from('users')
        .select('id')
        .eq('email', validatedData.email)
        .maybeSingle();

      if (existingUser) {
        throw new Error('Email already exists');
      }

      // Hash password
      const password_hash = await User.hashPassword(validatedData.password);

      // Set default permissions based on role
      const permissions = validatedData.permissions || ROLE_PERMISSIONS[validatedData.role] || [];

      const userToInsert = {
        ...validatedData,
        password_hash,
        permissions,
      };
      delete userToInsert.password;

      // Insert user into database
      const { data, error } = await supabase
        .from('users')
        .insert([userToInsert])
        .select()
        .single();

      if (error) {
        logger.error('Failed to create user:', error);
        throw new Error('Failed to create user');
      }

      logger.info(`User created successfully: ${data.email}`);
      return new User(data);
    } catch (error) {
      logger.error('User creation error:', error);
      throw error;
    }
  }

  // Find user by ID
  static async findById(userId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          banks (id, name, code),
          branches (id, name, address)
        `)
        .eq('id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      return new User(data);
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          banks (id, name, code),
          branches (id, name, address)
        `)
        .eq('email', email)
        .single();

      if (error || !data) {
        return null;
      }

      return new User(data);
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  // Update user
  async update(updateData) {
    try {
      const { error: validationError } = userUpdateSchema.validate(updateData);
      if (validationError) {
        throw new Error(`Validation error: ${validationError.details[0].message}`);
      }

      const { data, error } = await supabase
        .from('users')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.id)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update user:', error);
        throw new Error('Failed to update user');
      }

      Object.assign(this, data);
      logger.info(`User updated successfully: ${this.email}`);
      return this;
    } catch (error) {
      logger.error('User update error:', error);
      throw error;
    }
  }

  // Check if user has permission
  hasPermission(permission) {
    return this.permissions.includes(permission) || this.role === USER_ROLES.SUPER_ADMIN;
  }

  // Check if user has any of the permissions
  hasAnyPermission(permissions) {
    return permissions.some(permission => this.hasPermission(permission));
  }

  // Check if user has all permissions
  hasAllPermissions(permissions) {
    return permissions.every(permission => this.hasPermission(permission));
  }

  // Activate user
  async activate() {
    try {
      await this.update({ status: USER_STATUS.ACTIVE });
      logger.info(`User activated: ${this.email}`);
      return this;
    } catch (error) {
      logger.error('User activation error:', error);
      throw error;
    }
  }

  // Suspend user
  async suspend(reason = '') {
    try {
      await this.update({ status: USER_STATUS.SUSPENDED });
      logger.info(`User suspended: ${this.email} - Reason: ${reason}`);
      return this;
    } catch (error) {
      logger.error('User suspension error:', error);
      throw error;
    }
  }

  // Lock user account
  async lock(duration = 30) {
    try {
      const locked_until = new Date(Date.now() + duration * 60 * 1000).toISOString();
      await this.update({ 
        status: USER_STATUS.LOCKED,
        locked_until,
        login_attempts: this.login_attempts + 1,
      });
      logger.info(`User locked: ${this.email} until ${locked_until}`);
      return this;
    } catch (error) {
      logger.error('User lock error:', error);
      throw error;
    }
  }

  // Update last login
  async updateLastLogin() {
    try {
      await this.update({ 
        last_login: new Date().toISOString(),
        login_attempts: 0,
      });
      return this;
    } catch (error) {
      logger.error('Update last login error:', error);
      throw error;
    }
  }

  // Get user summary
  getSummary() {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      phone: this.phone,
      role: this.role,
      status: this.status,
      employee_id: this.employee_id,
      department: this.department,
      designation: this.designation,
      last_login: this.last_login,
      created_at: this.created_at,
    };
  }

  // Check if user is active
  isActive() {
    return this.status === USER_STATUS.ACTIVE;
  }

  // Check if user is locked
  isLocked() {
    if (this.status === USER_STATUS.LOCKED && this.locked_until) {
      return new Date() < new Date(this.locked_until);
    }
    return this.status === USER_STATUS.LOCKED;
  }
}

module.exports = {
  User,
  USER_ROLES,
  USER_STATUS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
};
