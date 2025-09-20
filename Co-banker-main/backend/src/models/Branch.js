const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const { supabase, supabaseAdmin } = require('../config/database');
const { logger } = require('../utils/logger');

// Branch types
const BRANCH_TYPES = {
  HEAD_OFFICE: 'head_office',
  MAIN_BRANCH: 'main_branch',
  SUB_BRANCH: 'sub_branch',
  EXTENSION_COUNTER: 'extension_counter',
  ATM_CENTER: 'atm_center',
};

// Branch statuses
const BRANCH_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  UNDER_MAINTENANCE: 'under_maintenance',
  TEMPORARILY_CLOSED: 'temporarily_closed',
  PERMANENTLY_CLOSED: 'permanently_closed',
};

// Validation schemas
const branchValidationSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  branch_code: Joi.string().min(3).max(20).required(),
  branch_type: Joi.string().valid(...Object.values(BRANCH_TYPES)).required(),
  bank_id: Joi.string().uuid().required(),
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
  manager_name: Joi.string().max(100).optional(),
  manager_contact: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
  ifsc_code: Joi.string().length(11).optional(),
  micr_code: Joi.string().length(9).optional(),
  swift_code: Joi.string().length(8).optional(),
  working_hours: Joi.object({
    monday: Joi.string().optional(),
    tuesday: Joi.string().optional(),
    wednesday: Joi.string().optional(),
    thursday: Joi.string().optional(),
    friday: Joi.string().optional(),
    saturday: Joi.string().optional(),
    sunday: Joi.string().optional(),
  }).optional(),
  services_offered: Joi.array().items(Joi.string()).optional(),
  description: Joi.string().max(500).optional(),
});

const branchUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  branch_type: Joi.string().valid(...Object.values(BRANCH_TYPES)),
  status: Joi.string().valid(...Object.values(BRANCH_STATUS)),
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
  manager_name: Joi.string().max(100),
  manager_contact: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
  ifsc_code: Joi.string().length(11),
  micr_code: Joi.string().length(9),
  swift_code: Joi.string().length(8),
  working_hours: Joi.object({
    monday: Joi.string(),
    tuesday: Joi.string(),
    wednesday: Joi.string(),
    thursday: Joi.string(),
    friday: Joi.string(),
    saturday: Joi.string(),
    sunday: Joi.string(),
  }),
  services_offered: Joi.array().items(Joi.string()),
  description: Joi.string().max(500),
});

class Branch {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.branch_code = data.branch_code;
    this.branch_type = data.branch_type;
    this.bank_id = data.bank_id;
    this.address = data.address;
    this.contact_info = data.contact_info;
    this.manager_name = data.manager_name;
    this.manager_contact = data.manager_contact;
    this.ifsc_code = data.ifsc_code;
    this.micr_code = data.micr_code;
    this.swift_code = data.swift_code;
    this.working_hours = data.working_hours;
    this.services_offered = data.services_offered || [];
    this.status = data.status || BRANCH_STATUS.ACTIVE;
    this.description = data.description;
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
  }

  // Validate branch data
  validate() {
    const { error, value } = branchValidationSchema.validate(this, { allowUnknown: true });
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }
    return value;
  }

  // Create new branch
  static async create(branchData) {
    try {
      const branch = new Branch(branchData);
      const validatedData = branch.validate();

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

      // Check if branch code is unique within the bank
      const { data: existingBranch, error: existingError } = await supabase
        .from('branches')
        .select('id')
        .eq('branch_code', validatedData.branch_code)
        .eq('bank_id', validatedData.bank_id)
        .maybeSingle();

      if (existingBranch) {
        throw new Error('Branch code already exists for this bank');
      }

      // Insert branch into database
      const { data, error } = await supabase
        .from('branches')
        .insert([validatedData])
        .select()
        .single();

      if (error) {
        logger.error('Failed to create branch:', error);
        throw new Error('Failed to create branch');
      }

      logger.info(`Branch created successfully: ${data.name} (${data.branch_code})`);
      return new Branch(data);
    } catch (error) {
      logger.error('Branch creation error:', error);
      throw error;
    }
  }

  // Get branch by ID
  static async findById(branchId) {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select(`
          *,
          banks (id, name, code, status)
        `)
        .eq('id', branchId)
        .single();

      if (error || !data) {
        return null;
      }

      return new Branch(data);
    } catch (error) {
      logger.error('Error finding branch by ID:', error);
      throw error;
    }
  }

  // Get branch by branch code
  static async findByBranchCode(branchCode, bankId) {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select(`
          *,
          banks (id, name, code, status)
        `)
        .eq('branch_code', branchCode)
        .eq('bank_id', bankId)
        .single();

      if (error || !data) {
        return null;
      }

      return new Branch(data);
    } catch (error) {
      logger.error('Error finding branch by code:', error);
      throw error;
    }
  }

  // Get branches by bank ID
  static async findByBankId(bankId) {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('bank_id', bankId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data.map(branch => new Branch(branch));
    } catch (error) {
      logger.error('Error finding branches by bank ID:', error);
      throw error;
    }
  }

  // Update branch
  async update(updateData) {
    try {
      const { error: validationError } = branchUpdateSchema.validate(updateData);
      if (validationError) {
        throw new Error(`Validation error: ${validationError.details[0].message}`);
      }

      const { data, error } = await supabase
        .from('branches')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.id)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update branch:', error);
        throw new Error('Failed to update branch');
      }

      Object.assign(this, data);
      logger.info(`Branch updated successfully: ${this.name} (${this.branch_code})`);
      return this;
    } catch (error) {
      logger.error('Branch update error:', error);
      throw error;
    }
  }

  // Activate branch
  async activate() {
    try {
      const { error } = await supabase
        .from('branches')
        .update({
          status: BRANCH_STATUS.ACTIVE,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.id);

      if (error) {
        logger.error('Failed to activate branch:', error);
        throw new Error('Failed to activate branch');
      }

      this.status = BRANCH_STATUS.ACTIVE;
      logger.info(`Branch activated: ${this.name} (${this.branch_code})`);
      return this;
    } catch (error) {
      logger.error('Branch activation error:', error);
      throw error;
    }
  }

  // Deactivate branch
  async deactivate() {
    try {
      const { error } = await supabase
        .from('branches')
        .update({
          status: BRANCH_STATUS.INACTIVE,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.id);

      if (error) {
        logger.error('Failed to deactivate branch:', error);
        throw new Error('Failed to deactivate branch');
      }

      this.status = BRANCH_STATUS.INACTIVE;
      logger.info(`Branch deactivated: ${this.name} (${this.branch_code})`);
      return this;
    } catch (error) {
      logger.error('Branch deactivation error:', error);
      throw error;
    }
  }

  // Get branch summary
  getSummary() {
    return {
      id: this.id,
      name: this.name,
      branch_code: this.branch_code,
      branch_type: this.branch_type,
      status: this.status,
      address: this.address,
      contact_info: this.contact_info,
      manager_name: this.manager_name,
      ifsc_code: this.ifsc_code,
      created_at: this.created_at,
    };
  }

  // Check if branch is active
  isActive() {
    return this.status === BRANCH_STATUS.ACTIVE;
  }

  // Get full address as string
  getFullAddress() {
    if (!this.address) return '';
    
    const { street, city, state, postal_code, country } = this.address;
    return `${street}, ${city}, ${state} ${postal_code}, ${country}`;
  }
}

module.exports = {
  Branch,
  BRANCH_TYPES,
  BRANCH_STATUS,
};
