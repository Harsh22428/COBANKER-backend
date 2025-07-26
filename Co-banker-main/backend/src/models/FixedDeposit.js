const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const { supabase, supabaseAdmin } = require('../config/database');
const { logger } = require('../utils/logger');
const moment = require('moment');

// Fixed Deposit types
const FD_TYPES = {
  REGULAR: 'regular',
  SENIOR_CITIZEN: 'senior_citizen',
  CUMULATIVE: 'cumulative',
  NON_CUMULATIVE: 'non_cumulative',
};

// Fixed Deposit statuses
const FD_STATUS = {
  ACTIVE: 'active',
  MATURED: 'matured',
  PREMATURE_CLOSED: 'premature_closed',
  RENEWED: 'renewed',
  PENDING: 'pending',
};

// Validation schemas
const fdValidationSchema = Joi.object({
  customer_id: Joi.string().uuid().required(),
  fd_type: Joi.string().valid(...Object.values(FD_TYPES)).required(),
  principal_amount: Joi.number().min(1000).required(),
  interest_rate: Joi.number().min(0).max(50).required(),
  tenure_months: Joi.number().min(6).max(120).required(),
  maturity_amount: Joi.number().min(0).optional(),
  branch_id: Joi.string().uuid().required(),
  bank_id: Joi.string().uuid().required(),
  nominee_name: Joi.string().max(100).optional(),
  nominee_relationship: Joi.string().max(50).optional(),
  auto_renewal: Joi.boolean().default(false),
  description: Joi.string().max(500).optional(),
});

const fdUpdateSchema = Joi.object({
  interest_rate: Joi.number().min(0).max(50),
  status: Joi.string().valid(...Object.values(FD_STATUS)),
  nominee_name: Joi.string().max(100),
  nominee_relationship: Joi.string().max(50),
  auto_renewal: Joi.boolean(),
  description: Joi.string().max(500),
});

class FixedDeposit {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.fd_number = data.fd_number || this.generateFDNumber();
    this.customer_id = data.customer_id;
    this.fd_type = data.fd_type;
    this.principal_amount = data.principal_amount;
    this.interest_rate = data.interest_rate;
    this.tenure_months = data.tenure_months;
    this.maturity_amount = data.maturity_amount || this.calculateMaturityAmount();
    this.maturity_date = data.maturity_date || this.calculateMaturityDate();
    this.status = data.status || FD_STATUS.PENDING;
    this.branch_id = data.branch_id;
    this.bank_id = data.bank_id;
    this.nominee_name = data.nominee_name;
    this.nominee_relationship = data.nominee_relationship;
    this.auto_renewal = data.auto_renewal || false;
    this.description = data.description;
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
    this.start_date = data.start_date || new Date().toISOString();
  }

  // Generate unique FD number
  generateFDNumber() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `FD${timestamp.slice(-8)}${random}`;
  }

  // Calculate maturity amount based on compound interest
  calculateMaturityAmount() {
    if (!this.principal_amount || !this.interest_rate || !this.tenure_months) {
      return 0;
    }
    
    const principal = this.principal_amount;
    const rate = this.interest_rate / 100;
    const time = this.tenure_months / 12;
    
    // Compound interest formula: A = P(1 + r/n)^(nt)
    // For quarterly compounding (n=4)
    const compoundingFrequency = 4;
    const maturityAmount = principal * Math.pow(
      (1 + rate / compoundingFrequency), 
      compoundingFrequency * time
    );
    
    return Math.round(maturityAmount * 100) / 100; // Round to 2 decimal places
  }

  // Calculate maturity date
  calculateMaturityDate() {
    if (!this.tenure_months) {
      return null;
    }
    
    const startDate = this.start_date ? new Date(this.start_date) : new Date();
    return moment(startDate).add(this.tenure_months, 'months').toISOString();
  }

  // Validate FD data
  validate() {
    const { error, value } = fdValidationSchema.validate(this, { allowUnknown: true });
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }
    return value;
  }

  // Create new Fixed Deposit
  static async create(fdData) {
    try {
      const fd = new FixedDeposit(fdData);
      const validatedData = fd.validate();

      // Check if customer exists and is active
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, status')
        .eq('id', validatedData.customer_id)
        .single();

      if (customerError || !customer) {
        throw new Error('Customer not found');
      }

      if (customer.status !== 'active') {
        throw new Error('Customer account is not active');
      }

      // Check if branch exists
      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('id')
        .eq('id', validatedData.branch_id)
        .single();

      if (branchError || !branch) {
        throw new Error('Branch not found');
      }

      // Insert FD into database
      const { data, error } = await supabase
        .from('fixed_deposits')
        .insert([validatedData])
        .select()
        .single();

      if (error) {
        logger.error('Failed to create fixed deposit:', error);
        throw new Error('Failed to create fixed deposit');
      }

      logger.info(`Fixed Deposit created successfully: ${data.fd_number}`);
      return new FixedDeposit(data);
    } catch (error) {
      logger.error('Fixed Deposit creation error:', error);
      throw error;
    }
  }

  // Get FD by ID
  static async findById(fdId) {
    try {
      const { data, error } = await supabase
        .from('fixed_deposits')
        .select(`
          *,
          customers (id, name, email, phone),
          branches (id, name, address),
          banks (id, name, code)
        `)
        .eq('id', fdId)
        .single();

      if (error || !data) {
        return null;
      }

      return new FixedDeposit(data);
    } catch (error) {
      logger.error('Error finding FD by ID:', error);
      throw error;
    }
  }

  // Get FD by FD number
  static async findByFDNumber(fdNumber) {
    try {
      const { data, error } = await supabase
        .from('fixed_deposits')
        .select(`
          *,
          customers (id, name, email, phone),
          branches (id, name, address),
          banks (id, name, code)
        `)
        .eq('fd_number', fdNumber)
        .single();

      if (error || !data) {
        return null;
      }

      return new FixedDeposit(data);
    } catch (error) {
      logger.error('Error finding FD by number:', error);
      throw error;
    }
  }

  // Get FDs by customer ID
  static async findByCustomerId(customerId) {
    try {
      const { data, error } = await supabase
        .from('fixed_deposits')
        .select(`
          *,
          branches (id, name, address),
          banks (id, name, code)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data.map(fd => new FixedDeposit(fd));
    } catch (error) {
      logger.error('Error finding FDs by customer ID:', error);
      throw error;
    }
  }

  // Update FD
  async update(updateData) {
    try {
      const { error: validationError } = fdUpdateSchema.validate(updateData);
      if (validationError) {
        throw new Error(`Validation error: ${validationError.details[0].message}`);
      }

      const { data, error } = await supabase
        .from('fixed_deposits')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.id)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update fixed deposit:', error);
        throw new Error('Failed to update fixed deposit');
      }

      // Update current instance
      Object.assign(this, data);
      logger.info(`Fixed Deposit updated successfully: ${this.fd_number}`);
      return this;
    } catch (error) {
      logger.error('Fixed Deposit update error:', error);
      throw error;
    }
  }

  // Mature FD
  async mature() {
    try {
      if (this.status !== FD_STATUS.ACTIVE) {
        throw new Error('Only active FDs can be matured');
      }

      const { error } = await supabase
        .from('fixed_deposits')
        .update({
          status: FD_STATUS.MATURED,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.id);

      if (error) {
        logger.error('Failed to mature fixed deposit:', error);
        throw new Error('Failed to mature fixed deposit');
      }

      this.status = FD_STATUS.MATURED;
      logger.info(`Fixed Deposit matured: ${this.fd_number}`);
      return this;
    } catch (error) {
      logger.error('Fixed Deposit maturity error:', error);
      throw error;
    }
  }

  // Premature closure
  async prematureClose(penaltyRate = 1) {
    try {
      if (this.status !== FD_STATUS.ACTIVE) {
        throw new Error('Only active FDs can be closed prematurely');
      }

      // Calculate premature closure amount with penalty
      const monthsCompleted = moment().diff(moment(this.start_date), 'months');
      const reducedRate = Math.max(0, this.interest_rate - penaltyRate);
      const prematureAmount = this.principal_amount * Math.pow(
        (1 + reducedRate / 100 / 4), 
        4 * (monthsCompleted / 12)
      );

      const { error } = await supabase
        .from('fixed_deposits')
        .update({
          status: FD_STATUS.PREMATURE_CLOSED,
          maturity_amount: Math.round(prematureAmount * 100) / 100,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.id);

      if (error) {
        logger.error('Failed to close fixed deposit prematurely:', error);
        throw new Error('Failed to close fixed deposit prematurely');
      }

      this.status = FD_STATUS.PREMATURE_CLOSED;
      this.maturity_amount = Math.round(prematureAmount * 100) / 100;
      logger.info(`Fixed Deposit closed prematurely: ${this.fd_number}`);
      return this;
    } catch (error) {
      logger.error('Fixed Deposit premature closure error:', error);
      throw error;
    }
  }

  // Get FD summary
  getSummary() {
    return {
      id: this.id,
      fd_number: this.fd_number,
      fd_type: this.fd_type,
      principal_amount: this.principal_amount,
      interest_rate: this.interest_rate,
      tenure_months: this.tenure_months,
      maturity_amount: this.maturity_amount,
      maturity_date: this.maturity_date,
      status: this.status,
      created_at: this.created_at,
    };
  }

  // Check if FD is matured
  isMatured() {
    return moment().isAfter(moment(this.maturity_date));
  }

  // Check if FD is active
  isActive() {
    return this.status === FD_STATUS.ACTIVE;
  }
}

module.exports = {
  FixedDeposit,
  FD_TYPES,
  FD_STATUS,
};
