const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const { supabase, supabaseAdmin } = require('../config/database');
const { logger } = require('../utils/logger');
const moment = require('moment');

// Dividend types
const DIVIDEND_TYPES = {
  ANNUAL: 'annual',
  INTERIM: 'interim',
  BONUS: 'bonus',
  SPECIAL: 'special',
};

// Dividend statuses
const DIVIDEND_STATUS = {
  DECLARED: 'declared',
  APPROVED: 'approved',
  PAID: 'paid',
  CANCELLED: 'cancelled',
  PENDING: 'pending',
};

// Validation schemas
const dividendValidationSchema = Joi.object({
  dividend_year: Joi.number().integer().min(2000).max(2100).required(),
  dividend_type: Joi.string().valid(...Object.values(DIVIDEND_TYPES)).required(),
  dividend_rate: Joi.number().min(0).max(100).precision(2).required(),
  total_dividend_amount: Joi.number().min(0).required(),
  bank_id: Joi.string().uuid().required(),
  declaration_date: Joi.date().iso().default(() => new Date().toISOString()),
  record_date: Joi.date().iso().required(),
  payment_date: Joi.date().iso().required(),
  description: Joi.string().max(500).optional(),
  board_resolution_number: Joi.string().max(100).optional(),
});

const dividendUpdateSchema = Joi.object({
  dividend_rate: Joi.number().min(0).max(100).precision(2),
  total_dividend_amount: Joi.number().min(0),
  status: Joi.string().valid(...Object.values(DIVIDEND_STATUS)),
  payment_date: Joi.date().iso(),
  description: Joi.string().max(500),
  board_resolution_number: Joi.string().max(100),
});

class Dividend {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.dividend_number = data.dividend_number || this.generateDividendNumber();
    this.dividend_year = data.dividend_year;
    this.dividend_type = data.dividend_type;
    this.dividend_rate = data.dividend_rate;
    this.total_dividend_amount = data.total_dividend_amount;
    this.bank_id = data.bank_id;
    this.status = data.status || DIVIDEND_STATUS.PENDING;
    this.declaration_date = data.declaration_date || new Date().toISOString();
    this.record_date = data.record_date;
    this.payment_date = data.payment_date;
    this.description = data.description;
    this.board_resolution_number = data.board_resolution_number;
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
  }

  // Generate unique dividend number
  generateDividendNumber() {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `DIV${year}${timestamp.slice(-6)}${random}`;
  }

  // Validate dividend data
  validate() {
    const { error, value } = dividendValidationSchema.validate(this, { allowUnknown: true });
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }
    return value;
  }

  // Create new dividend declaration
  static async create(dividendData) {
    try {
      const dividend = new Dividend(dividendData);
      const validatedData = dividend.validate();

      // Check if bank exists
      const { data: bank, error: bankError } = await supabase
        .from('banks')
        .select('id, status')
        .eq('id', validatedData.bank_id)
        .single();

      if (bankError || !bank) {
        throw new Error('Bank not found');
      }

      if (bank.status !== 'active') {
        throw new Error('Bank is not active');
      }

      // Check if dividend already declared for this year and type
      const { data: existingDividend, error: existingError } = await supabase
        .from('dividends')
        .select('id')
        .eq('dividend_year', validatedData.dividend_year)
        .eq('dividend_type', validatedData.dividend_type)
        .eq('bank_id', validatedData.bank_id)
        .maybeSingle();

      if (existingDividend) {
        throw new Error(`${validatedData.dividend_type} dividend already declared for year ${validatedData.dividend_year}`);
      }

      // Insert dividend into database
      const { data, error } = await supabase
        .from('dividends')
        .insert([validatedData])
        .select()
        .single();

      if (error) {
        logger.error('Failed to create dividend:', error);
        throw new Error('Failed to create dividend declaration');
      }

      logger.info(`Dividend declared successfully: ${data.dividend_number}`);
      return new Dividend(data);
    } catch (error) {
      logger.error('Dividend creation error:', error);
      throw error;
    }
  }

  // Get dividend by ID
  static async findById(dividendId) {
    try {
      const { data, error } = await supabase
        .from('dividends')
        .select(`
          *,
          banks (id, name, code)
        `)
        .eq('id', dividendId)
        .single();

      if (error || !data) {
        return null;
      }

      return new Dividend(data);
    } catch (error) {
      logger.error('Error finding dividend by ID:', error);
      throw error;
    }
  }

  // Get dividends by bank ID
  static async findByBankId(bankId, filters = {}) {
    try {
      let query = supabase
        .from('dividends')
        .select('*')
        .eq('bank_id', bankId);

      // Apply filters
      if (filters.dividend_year) {
        query = query.eq('dividend_year', filters.dividend_year);
      }
      if (filters.dividend_type) {
        query = query.eq('dividend_type', filters.dividend_type);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      query = query.order('dividend_year', { ascending: false });

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data.map(dividend => new Dividend(dividend));
    } catch (error) {
      logger.error('Error finding dividends by bank ID:', error);
      throw error;
    }
  }

  // Update dividend
  async update(updateData) {
    try {
      const { error: validationError } = dividendUpdateSchema.validate(updateData);
      if (validationError) {
        throw new Error(`Validation error: ${validationError.details[0].message}`);
      }

      const { data, error } = await supabase
        .from('dividends')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.id)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update dividend:', error);
        throw new Error('Failed to update dividend');
      }

      Object.assign(this, data);
      logger.info(`Dividend updated successfully: ${this.dividend_number}`);
      return this;
    } catch (error) {
      logger.error('Dividend update error:', error);
      throw error;
    }
  }

  // Approve dividend
  async approve() {
    try {
      if (this.status !== DIVIDEND_STATUS.DECLARED) {
        throw new Error('Only declared dividends can be approved');
      }

      const { error } = await supabase
        .from('dividends')
        .update({
          status: DIVIDEND_STATUS.APPROVED,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.id);

      if (error) {
        logger.error('Failed to approve dividend:', error);
        throw new Error('Failed to approve dividend');
      }

      this.status = DIVIDEND_STATUS.APPROVED;
      logger.info(`Dividend approved: ${this.dividend_number}`);
      return this;
    } catch (error) {
      logger.error('Dividend approval error:', error);
      throw error;
    }
  }

  // Distribute dividend to members
  async distribute() {
    try {
      if (this.status !== DIVIDEND_STATUS.APPROVED) {
        throw new Error('Only approved dividends can be distributed');
      }

      // Get all eligible members with shares as of record date
      const { data: eligibleMembers, error: membersError } = await supabase
        .from('shares')
        .select(`
          member_id,
          number_of_shares,
          share_value,
          members (member_id, name, email, status)
        `)
        .eq('status', 'active')
        .lte('created_at', this.record_date);

      if (membersError) {
        throw new Error('Failed to fetch eligible members');
      }

      // Calculate dividend for each member
      const dividendDistributions = [];
      let totalDistributed = 0;

      for (const share of eligibleMembers) {
        if (share.members.status === 'active') {
          const memberDividend = (share.number_of_shares * share.share_value * this.dividend_rate) / 100;
          
          dividendDistributions.push({
            id: uuidv4(),
            dividend_id: this.id,
            member_id: share.member_id,
            number_of_shares: share.number_of_shares,
            dividend_amount: memberDividend,
            payment_status: 'pending',
            created_at: new Date().toISOString(),
          });

          totalDistributed += memberDividend;
        }
      }

      // Insert dividend distributions
      const { error: distributionError } = await supabase
        .from('dividend_distributions')
        .insert(dividendDistributions);

      if (distributionError) {
        logger.error('Failed to create dividend distributions:', distributionError);
        throw new Error('Failed to create dividend distributions');
      }

      // Update dividend status
      await this.update({
        status: DIVIDEND_STATUS.PAID,
        total_dividend_amount: totalDistributed,
      });

      logger.info(`Dividend distributed: ${this.dividend_number} to ${dividendDistributions.length} members`);
      return {
        total_members: dividendDistributions.length,
        total_amount: totalDistributed,
        distributions: dividendDistributions,
      };
    } catch (error) {
      logger.error('Dividend distribution error:', error);
      throw error;
    }
  }

  // Get dividend distributions
  async getDistributions() {
    try {
      const { data, error } = await supabase
        .from('dividend_distributions')
        .select(`
          *,
          members (member_id, name, email, phone)
        `)
        .eq('dividend_id', this.id)
        .order('dividend_amount', { ascending: false });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error fetching dividend distributions:', error);
      throw error;
    }
  }

  // Cancel dividend
  async cancel(reason) {
    try {
      if (this.status === DIVIDEND_STATUS.PAID) {
        throw new Error('Cannot cancel paid dividends');
      }

      const { error } = await supabase
        .from('dividends')
        .update({
          status: DIVIDEND_STATUS.CANCELLED,
          description: `${this.description || ''} | Cancelled: ${reason}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.id);

      if (error) {
        logger.error('Failed to cancel dividend:', error);
        throw new Error('Failed to cancel dividend');
      }

      this.status = DIVIDEND_STATUS.CANCELLED;
      logger.info(`Dividend cancelled: ${this.dividend_number} - Reason: ${reason}`);
      return this;
    } catch (error) {
      logger.error('Dividend cancellation error:', error);
      throw error;
    }
  }

  // Get dividend summary
  getSummary() {
    return {
      id: this.id,
      dividend_number: this.dividend_number,
      dividend_year: this.dividend_year,
      dividend_type: this.dividend_type,
      dividend_rate: this.dividend_rate,
      total_dividend_amount: this.total_dividend_amount,
      status: this.status,
      declaration_date: this.declaration_date,
      record_date: this.record_date,
      payment_date: this.payment_date,
      created_at: this.created_at,
    };
  }

  // Check if dividend is payable
  isPayable() {
    return this.status === DIVIDEND_STATUS.APPROVED && 
           moment().isSameOrAfter(moment(this.payment_date));
  }

  // Check if dividend is active
  isActive() {
    return [DIVIDEND_STATUS.DECLARED, DIVIDEND_STATUS.APPROVED, DIVIDEND_STATUS.PAID].includes(this.status);
  }
}

module.exports = {
  Dividend,
  DIVIDEND_TYPES,
  DIVIDEND_STATUS,
};
