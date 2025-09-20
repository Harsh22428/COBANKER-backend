const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const { supabase, supabaseAdmin } = require('../config/database');
const { logger } = require('../utils/logger');

// Share types
const SHARE_TYPES = {
  ORDINARY: 'ordinary',
  PREFERENCE: 'preference',
  BONUS: 'bonus',
  RIGHTS: 'rights',
};

// Share statuses
const SHARE_STATUS = {
  ACTIVE: 'active',
  TRANSFERRED: 'transferred',
  REDEEMED: 'redeemed',
  SUSPENDED: 'suspended',
  PENDING: 'pending',
};

// Transaction types for shares
const SHARE_TRANSACTION_TYPES = {
  PURCHASE: 'purchase',
  TRANSFER: 'transfer',
  REDEMPTION: 'redemption',
  DIVIDEND: 'dividend',
  BONUS_ISSUE: 'bonus_issue',
};

// Validation schemas
const shareValidationSchema = Joi.object({
  member_id: Joi.string().uuid().required(),
  share_type: Joi.string().valid(...Object.values(SHARE_TYPES)).required(),
  number_of_shares: Joi.number().integer().min(1).required(),
  share_value: Joi.number().min(1).required(),
  total_amount: Joi.number().min(1).required(),
  branch_id: Joi.string().uuid().required(),
  bank_id: Joi.string().uuid().required(),
  certificate_number: Joi.string().max(50).optional(),
  issue_date: Joi.date().iso().default(() => new Date().toISOString()),
  description: Joi.string().max(500).optional(),
});

const shareUpdateSchema = Joi.object({
  share_type: Joi.string().valid(...Object.values(SHARE_TYPES)),
  status: Joi.string().valid(...Object.values(SHARE_STATUS)),
  certificate_number: Joi.string().max(50),
  description: Joi.string().max(500),
});

const shareTransferSchema = Joi.object({
  from_member_id: Joi.string().uuid().required(),
  to_member_id: Joi.string().uuid().required(),
  number_of_shares: Joi.number().integer().min(1).required(),
  transfer_price: Joi.number().min(0).required(),
  transfer_reason: Joi.string().max(500).required(),
});

class Share {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.share_number = data.share_number || this.generateShareNumber();
    this.member_id = data.member_id;
    this.share_type = data.share_type;
    this.number_of_shares = data.number_of_shares;
    this.share_value = data.share_value;
    this.total_amount = data.total_amount || (data.number_of_shares * data.share_value);
    this.current_value = data.current_value || data.share_value;
    this.status = data.status || SHARE_STATUS.PENDING;
    this.branch_id = data.branch_id;
    this.bank_id = data.bank_id;
    this.certificate_number = data.certificate_number;
    this.issue_date = data.issue_date || new Date().toISOString();
    this.description = data.description;
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
  }

  // Generate unique share number
  generateShareNumber() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `SH${timestamp.slice(-8)}${random}`;
  }

  // Validate share data
  validate() {
    const { error, value } = shareValidationSchema.validate(this, { allowUnknown: true });
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }
    return value;
  }

  // Create new share allocation
  static async create(shareData) {
    try {
      const share = new Share(shareData);
      const validatedData = share.validate();

      // Check if member exists and is active
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('member_id, status')
        .eq('member_id', validatedData.member_id)
        .single();

      if (memberError || !member) {
        throw new Error('Member not found');
      }

      if (member.status !== 'active') {
        throw new Error('Member account is not active');
      }

      // Calculate total amount if not provided
      if (!validatedData.total_amount) {
        validatedData.total_amount = validatedData.number_of_shares * validatedData.share_value;
      }

      // Insert share into database
      const { data, error } = await supabase
        .from('shares')
        .insert([validatedData])
        .select()
        .single();

      if (error) {
        logger.error('Failed to create share:', error);
        throw new Error('Failed to create share allocation');
      }

      // Create share transaction record
      await Share.createTransaction({
        share_id: data.id,
        member_id: data.member_id,
        transaction_type: SHARE_TRANSACTION_TYPES.PURCHASE,
        number_of_shares: data.number_of_shares,
        amount: data.total_amount,
        description: 'Initial share purchase',
      });

      logger.info(`Share allocation created successfully: ${data.share_number}`);
      return new Share(data);
    } catch (error) {
      logger.error('Share creation error:', error);
      throw error;
    }
  }

  // Get share by ID
  static async findById(shareId) {
    try {
      const { data, error } = await supabase
        .from('shares')
        .select(`
          *,
          members (member_id, name, email, phone),
          branches (id, name, address),
          banks (id, name, code)
        `)
        .eq('id', shareId)
        .single();

      if (error || !data) {
        return null;
      }

      return new Share(data);
    } catch (error) {
      logger.error('Error finding share by ID:', error);
      throw error;
    }
  }

  // Get shares by member ID
  static async findByMemberId(memberId) {
    try {
      const { data, error } = await supabase
        .from('shares')
        .select(`
          *,
          branches (id, name, address),
          banks (id, name, code)
        `)
        .eq('member_id', memberId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data.map(share => new Share(share));
    } catch (error) {
      logger.error('Error finding shares by member ID:', error);
      throw error;
    }
  }

  // Update share
  async update(updateData) {
    try {
      const { error: validationError } = shareUpdateSchema.validate(updateData);
      if (validationError) {
        throw new Error(`Validation error: ${validationError.details[0].message}`);
      }

      const { data, error } = await supabase
        .from('shares')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.id)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update share:', error);
        throw new Error('Failed to update share');
      }

      Object.assign(this, data);
      logger.info(`Share updated successfully: ${this.share_number}`);
      return this;
    } catch (error) {
      logger.error('Share update error:', error);
      throw error;
    }
  }

  // Transfer shares between members
  static async transfer(transferData) {
    try {
      const { error: validationError } = shareTransferSchema.validate(transferData);
      if (validationError) {
        throw new Error(`Validation error: ${validationError.details[0].message}`);
      }

      const { from_member_id, to_member_id, number_of_shares, transfer_price, transfer_reason } = transferData;

      // Check if both members exist and are active
      const { data: fromMember, error: fromMemberError } = await supabase
        .from('members')
        .select('member_id, status')
        .eq('member_id', from_member_id)
        .single();

      const { data: toMember, error: toMemberError } = await supabase
        .from('members')
        .select('member_id, status')
        .eq('member_id', to_member_id)
        .single();

      if (fromMemberError || !fromMember || toMemberError || !toMember) {
        throw new Error('One or both members not found');
      }

      if (fromMember.status !== 'active' || toMember.status !== 'active') {
        throw new Error('Both members must be active for share transfer');
      }

      // Check if from_member has enough shares
      const { data: fromMemberShares, error: sharesError } = await supabase
        .from('shares')
        .select('number_of_shares')
        .eq('member_id', from_member_id)
        .eq('status', SHARE_STATUS.ACTIVE);

      if (sharesError) {
        throw new Error('Error checking member shares');
      }

      const totalShares = fromMemberShares.reduce((sum, share) => sum + share.number_of_shares, 0);
      if (totalShares < number_of_shares) {
        throw new Error('Insufficient shares for transfer');
      }

      // Create transfer transaction records
      await Share.createTransaction({
        member_id: from_member_id,
        transaction_type: SHARE_TRANSACTION_TYPES.TRANSFER,
        number_of_shares: -number_of_shares,
        amount: -transfer_price,
        description: `Share transfer to member ${to_member_id}: ${transfer_reason}`,
      });

      await Share.createTransaction({
        member_id: to_member_id,
        transaction_type: SHARE_TRANSACTION_TYPES.TRANSFER,
        number_of_shares: number_of_shares,
        amount: transfer_price,
        description: `Share transfer from member ${from_member_id}: ${transfer_reason}`,
      });

      logger.info(`Share transfer completed: ${number_of_shares} shares from ${from_member_id} to ${to_member_id}`);
      return true;
    } catch (error) {
      logger.error('Share transfer error:', error);
      throw error;
    }
  }

  // Create share transaction record
  static async createTransaction(transactionData) {
    try {
      const { data, error } = await supabase
        .from('share_transactions')
        .insert([{
          id: uuidv4(),
          ...transactionData,
          transaction_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        logger.error('Failed to create share transaction:', error);
        throw new Error('Failed to create share transaction');
      }

      return data;
    } catch (error) {
      logger.error('Share transaction creation error:', error);
      throw error;
    }
  }

  // Get share summary
  getSummary() {
    return {
      id: this.id,
      share_number: this.share_number,
      share_type: this.share_type,
      number_of_shares: this.number_of_shares,
      share_value: this.share_value,
      total_amount: this.total_amount,
      current_value: this.current_value,
      status: this.status,
      issue_date: this.issue_date,
      created_at: this.created_at,
    };
  }

  // Check if share is active
  isActive() {
    return this.status === SHARE_STATUS.ACTIVE;
  }

  // Calculate current market value
  calculateCurrentValue(currentMarketPrice) {
    return this.number_of_shares * currentMarketPrice;
  }
}

module.exports = {
  Share,
  SHARE_TYPES,
  SHARE_STATUS,
  SHARE_TRANSACTION_TYPES,
};
