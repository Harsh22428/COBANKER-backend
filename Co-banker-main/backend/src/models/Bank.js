const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const { supabase, supabaseAdmin } = require('../config/database');
const { logger } = require('../utils/logger');

// Bank types
const BANK_TYPES = {
  COOPERATIVE: 'cooperative',
  COMMERCIAL: 'commercial',
  RURAL: 'rural',
  URBAN: 'urban',
  CREDIT_UNION: 'credit_union',
};

// Bank statuses
const BANK_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  UNDER_REVIEW: 'under_review',
  SUSPENDED: 'suspended',
  CLOSED: 'closed',
};

// Validation schemas
const bankValidationSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  code: Joi.string().min(2).max(20).required(),
  bank_type: Joi.string().valid(...Object.values(BANK_TYPES)).required(),
  registration_number: Joi.string().max(100).required(),
  license_number: Joi.string().max(100).required(),
  address: Joi.object({
    street: Joi.string().max(200).required(),
    city: Joi.string().max(100).required(),
    state: Joi.string().max(100).required(),
    postal_code: Joi.string().max(20).required(),
    country: Joi.string().max(100).default('India'),
  }).required(),
  contact_info: Joi.object({
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    email: Joi.string().email().required(),
    fax: Joi.string().optional(),
    website: Joi.string().uri().optional(),
  }).required(),
  chairman_name: Joi.string().max(100).optional(),
  managing_director: Joi.string().max(100).optional(),
  established_date: Joi.date().iso().required(),
  rbi_registration: Joi.string().max(100).optional(),
  deposit_insurance: Joi.boolean().default(true),
  minimum_share_capital: Joi.number().min(0).default(0),
  authorized_capital: Joi.number().min(0).required(),
  paid_up_capital: Joi.number().min(0).required(),
  reserve_fund: Joi.number().min(0).default(0),
  description: Joi.string().max(1000).optional(),
});

const bankUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(200),
  bank_type: Joi.string().valid(...Object.values(BANK_TYPES)),
  status: Joi.string().valid(...Object.values(BANK_STATUS)),
  address: Joi.object({
    street: Joi.string().max(200),
    city: Joi.string().max(100),
    state: Joi.string().max(100),
    postal_code: Joi.string().max(20),
    country: Joi.string().max(100),
  }),
  contact_info: Joi.object({
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
    email: Joi.string().email(),
    fax: Joi.string(),
    website: Joi.string().uri(),
  }),
  chairman_name: Joi.string().max(100),
  managing_director: Joi.string().max(100),
  rbi_registration: Joi.string().max(100),
  deposit_insurance: Joi.boolean(),
  minimum_share_capital: Joi.number().min(0),
  authorized_capital: Joi.number().min(0),
  paid_up_capital: Joi.number().min(0),
  reserve_fund: Joi.number().min(0),
  description: Joi.string().max(1000),
});

class Bank {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.code = data.code;
    this.bank_type = data.bank_type;
    this.registration_number = data.registration_number;
    this.license_number = data.license_number;
    this.address = data.address;
    this.contact_info = data.contact_info;
    this.chairman_name = data.chairman_name;
    this.managing_director = data.managing_director;
    this.established_date = data.established_date;
    this.rbi_registration = data.rbi_registration;
    this.deposit_insurance = data.deposit_insurance !== false;
    this.minimum_share_capital = data.minimum_share_capital || 0;
    this.authorized_capital = data.authorized_capital;
    this.paid_up_capital = data.paid_up_capital;
    this.reserve_fund = data.reserve_fund || 0;
    this.status = data.status || BANK_STATUS.ACTIVE;
    this.description = data.description;
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
  }

  // Validate bank data
  validate() {
    const { error, value } = bankValidationSchema.validate(this, { allowUnknown: true });
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }
    return value;
  }

  // Create new bank
  static async create(bankData) {
    try {
      const bank = new Bank(bankData);
      const validatedData = bank.validate();

      // Check if bank code is unique
      const { data: existingBank, error: existingError } = await supabase
        .from('banks')
        .select('id')
        .eq('code', validatedData.code)
        .maybeSingle();

      if (existingBank) {
        throw new Error('Bank code already exists');
      }

      // Check if registration number is unique
      const { data: existingReg, error: regError } = await supabase
        .from('banks')
        .select('id')
        .eq('registration_number', validatedData.registration_number)
        .maybeSingle();

      if (existingReg) {
        throw new Error('Registration number already exists');
      }

      // Insert bank into database
      const { data, error } = await supabase
        .from('banks')
        .insert([validatedData])
        .select()
        .single();

      if (error) {
        logger.error('Failed to create bank:', error);
        throw new Error('Failed to create bank');
      }

      logger.info(`Bank created successfully: ${data.name} (${data.code})`);
      return new Bank(data);
    } catch (error) {
      logger.error('Bank creation error:', error);
      throw error;
    }
  }

  // Get bank by ID
  static async findById(bankId) {
    try {
      const { data, error } = await supabase
        .from('banks')
        .select('*')
        .eq('id', bankId)
        .single();

      if (error || !data) {
        return null;
      }

      return new Bank(data);
    } catch (error) {
      logger.error('Error finding bank by ID:', error);
      throw error;
    }
  }

  // Get bank by code
  static async findByCode(bankCode) {
    try {
      const { data, error } = await supabase
        .from('banks')
        .select('*')
        .eq('code', bankCode)
        .single();

      if (error || !data) {
        return null;
      }

      return new Bank(data);
    } catch (error) {
      logger.error('Error finding bank by code:', error);
      throw error;
    }
  }

  // Get all banks
  static async findAll(filters = {}) {
    try {
      let query = supabase.from('banks').select('*');

      // Apply filters
      if (filters.bank_type) {
        query = query.eq('bank_type', filters.bank_type);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.state) {
        query = query.eq('address->state', filters.state);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data.map(bank => new Bank(bank));
    } catch (error) {
      logger.error('Error finding all banks:', error);
      throw error;
    }
  }

  // Update bank
  async update(updateData) {
    try {
      const { error: validationError } = bankUpdateSchema.validate(updateData);
      if (validationError) {
        throw new Error(`Validation error: ${validationError.details[0].message}`);
      }

      const { data, error } = await supabase
        .from('banks')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.id)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update bank:', error);
        throw new Error('Failed to update bank');
      }

      Object.assign(this, data);
      logger.info(`Bank updated successfully: ${this.name} (${this.code})`);
      return this;
    } catch (error) {
      logger.error('Bank update error:', error);
      throw error;
    }
  }

  // Activate bank
  async activate() {
    try {
      const { error } = await supabase
        .from('banks')
        .update({
          status: BANK_STATUS.ACTIVE,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.id);

      if (error) {
        logger.error('Failed to activate bank:', error);
        throw new Error('Failed to activate bank');
      }

      this.status = BANK_STATUS.ACTIVE;
      logger.info(`Bank activated: ${this.name} (${this.code})`);
      return this;
    } catch (error) {
      logger.error('Bank activation error:', error);
      throw error;
    }
  }

  // Suspend bank
  async suspend(reason = '') {
    try {
      const { error } = await supabase
        .from('banks')
        .update({
          status: BANK_STATUS.SUSPENDED,
          description: `${this.description || ''} | Suspended: ${reason}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.id);

      if (error) {
        logger.error('Failed to suspend bank:', error);
        throw new Error('Failed to suspend bank');
      }

      this.status = BANK_STATUS.SUSPENDED;
      logger.info(`Bank suspended: ${this.name} (${this.code}) - Reason: ${reason}`);
      return this;
    } catch (error) {
      logger.error('Bank suspension error:', error);
      throw error;
    }
  }

  // Get bank branches
  async getBranches() {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('bank_id', this.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error fetching bank branches:', error);
      throw error;
    }
  }

  // Get bank statistics
  async getStatistics() {
    try {
      // Get branches count
      const { data: branches, error: branchError } = await supabase
        .from('branches')
        .select('id, status')
        .eq('bank_id', this.id);

      // Get members count
      const { data: members, error: memberError } = await supabase
        .from('members')
        .select('member_id, status')
        .eq('bank_id', this.id);

      // Get accounts count and total balance
      const { data: accounts, error: accountError } = await supabase
        .from('accounts')
        .select('id, balance, status')
        .eq('bank_id', this.id);

      // Get loans count and total amount
      const { data: loans, error: loanError } = await supabase
        .from('loans')
        .select('loan_id, principal_amount, outstanding_amount, repayment_status')
        .eq('bank_id', this.id);

      if (branchError || memberError || accountError || loanError) {
        throw new Error('Failed to fetch bank statistics');
      }

      const stats = {
        branches: {
          total: branches?.length || 0,
          active: branches?.filter(b => b.status === 'active').length || 0,
        },
        members: {
          total: members?.length || 0,
          active: members?.filter(m => m.status === 'active').length || 0,
        },
        accounts: {
          total: accounts?.length || 0,
          active: accounts?.filter(a => a.status === 'active').length || 0,
          total_balance: accounts?.reduce((sum, a) => sum + (a.balance || 0), 0) || 0,
        },
        loans: {
          total: loans?.length || 0,
          active: loans?.filter(l => l.repayment_status === 'ongoing').length || 0,
          total_principal: loans?.reduce((sum, l) => sum + (l.principal_amount || 0), 0) || 0,
          total_outstanding: loans?.reduce((sum, l) => sum + (l.outstanding_amount || 0), 0) || 0,
        },
      };

      return stats;
    } catch (error) {
      logger.error('Error fetching bank statistics:', error);
      throw error;
    }
  }

  // Get bank summary
  getSummary() {
    return {
      id: this.id,
      name: this.name,
      code: this.code,
      bank_type: this.bank_type,
      status: this.status,
      address: this.address,
      contact_info: this.contact_info,
      established_date: this.established_date,
      authorized_capital: this.authorized_capital,
      paid_up_capital: this.paid_up_capital,
      created_at: this.created_at,
    };
  }

  // Check if bank is active
  isActive() {
    return this.status === BANK_STATUS.ACTIVE;
  }

  // Get full address as string
  getFullAddress() {
    if (!this.address) return '';
    
    const { street, city, state, postal_code, country } = this.address;
    return `${street}, ${city}, ${state} ${postal_code}, ${country}`;
  }
}

module.exports = {
  Bank,
  BANK_TYPES,
  BANK_STATUS,
};
