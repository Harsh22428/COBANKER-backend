const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const { supabase, supabaseAdmin } = require('../config/database');
const { logger } = require('../utils/logger');

// RD types
const RD_TYPES = {
  REGULAR: 'regular',
  SENIOR_CITIZEN: 'senior_citizen',
  MINOR: 'minor',
};

// RD statuses
const RD_STATUS = {
  ACTIVE: 'active',
  MATURED: 'matured',
  PREMATURE_CLOSED: 'premature_closed',
  SUSPENDED: 'suspended',
  PENDING: 'pending',
};

// Validation schema
const rdValidationSchema = Joi.object({
  member_id: Joi.string().uuid().required(),
  rd_type: Joi.string().valid(...Object.values(RD_TYPES)).required(),
  monthly_amount: Joi.number().min(100).required(),
  tenure_months: Joi.number().min(6).max(120).required(),
  interest_rate: Joi.number().min(0).max(50).required(),
  bank_id: Joi.string().uuid().required(),
  branch_id: Joi.string().uuid().required(),
});

// Recurring Deposit Model
const RecurringDeposit = {
  async create(data) {
    try {
      const { error: validationError } = rdValidationSchema.validate(data);
      if (validationError) {
        throw new Error(`Validation error: ${validationError.details[0].message}`);
      }

      const rdData = {
        id: uuidv4(),
        rd_number: `RD${Date.now()}${Math.floor(Math.random() * 1000)}`,
        ...data,
        status: RD_STATUS.PENDING,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: result, error } = await supabase
        .from('recurring_deposits')
        .insert([rdData])
        .select()
        .single();

      if (error) {
        logger.error('Failed to create recurring deposit:', error);
        throw new Error('Failed to create recurring deposit');
      }

      logger.info(`Recurring deposit created: ${result.rd_number}`);
      return { data: result, error: null };
    } catch (error) {
      logger.error('Recurring deposit creation error:', error);
      return { data: null, error: error.message };
    }
  },

  async findById(id) {
    try {
      if (!id) {
        throw new Error('ID is required');
      }

      const { data, error } = await supabase
        .from('recurring_deposits')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Error finding recurring deposit by ID:', error);
        throw new Error('Database error');
      }

      return { data: data || null, error: null };
    } catch (error) {
      logger.error('Find recurring deposit by ID error:', error);
      return { data: null, error: error.message };
    }
  },

  async findByAccount(account_id) {
    try {
      if (!account_id) {
        throw new Error('Account ID is required');
      }

      const { data, error } = await supabase
        .from('recurring_deposits')
        .select('*')
        .eq('account_id', account_id)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error finding recurring deposits by account:', error);
        throw new Error('Database error');
      }

      return { data: data || [], error: null };
    } catch (error) {
      logger.error('Find recurring deposits by account error:', error);
      return { data: [], error: error.message };
    }
  },

  async update(id, updates) {
    try {
      if (!id) {
        throw new Error('ID is required');
      }

      if (!updates || Object.keys(updates).length === 0) {
        throw new Error('Update data is required');
      }

      const updateData = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('recurring_deposits')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update recurring deposit:', error);
        throw new Error('Failed to update recurring deposit');
      }

      logger.info(`Recurring deposit updated: ${id}`);
      return { data, error: null };
    } catch (error) {
      logger.error('Recurring deposit update error:', error);
      return { data: null, error: error.message };
    }
  },

  async listByMember(member_id) {
    try {
      if (!member_id) {
        throw new Error('Member ID is required');
      }

      const { data, error } = await supabase
        .from('recurring_deposits')
        .select('*')
        .eq('member_id', member_id)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error listing recurring deposits by member:', error);
        throw new Error('Database error');
      }

      return { data: data || [], error: null };
    } catch (error) {
      logger.error('List recurring deposits by member error:', error);
      return { data: [], error: error.message };
    }
  },
};

// Penalty calculation for missed payments
const PENALTY_RATE = 0.01; // 1% of installment per missed payment (example)

RecurringDeposit.calculatePenalty = async function(rd_id) {
  // Get all missed payments for this RD
  const { data: payments } = await RecurringDepositPayment.listByRD(rd_id);
  if (!payments) return 0;
  let penalty = 0;
  payments.forEach(payment => {
    if (payment.status === 'missed') {
      penalty += Number(payment.amount) * PENALTY_RATE;
    }
  });
  return penalty;
};

// Early closure logic
RecurringDeposit.closeEarly = async function(rd_id) {
  // Fetch RD
  const { data: rd } = await RecurringDeposit.findById(rd_id);
  if (!rd) return { error: 'RD not found' };
  // Calculate penalty for early closure (e.g., 2% of total principal)
  const totalPrincipal = Number(rd.amount_per_installment) * Number(rd.total_installments);
  const earlyClosurePenalty = totalPrincipal * 0.02; // 2% penalty
  // Update RD status
  await RecurringDeposit.update(rd_id, { status: 'closed' });
  return { penalty: earlyClosurePenalty };
};

// Recurring Deposit Payment Model
const RecurringDepositPayment = {
  async create(data) {
    return await supabase.from('recurring_deposit_payments').insert([data]).select().single();
  },
  async findById(id) {
    return await supabase.from('recurring_deposit_payments').select('*').eq('id', id).single();
  },
  async listByRD(rd_id) {
    return await supabase.from('recurring_deposit_payments').select('*').eq('rd_id', rd_id);
  },
  async update(id, updates) {
    return await supabase.from('recurring_deposit_payments').update(updates).eq('id', id).select().single();
  },
};

module.exports = { RecurringDeposit, RecurringDepositPayment }; 