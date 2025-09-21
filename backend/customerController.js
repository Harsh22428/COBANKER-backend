const { supabase, supabaseAdmin } = require('../config/database');
const { customerCreateSchema, customerUpdateSchema } = require('../validators/customerValidator');
const { logger } = require('../utils/logger');

// In-memory fallback storage
let customers = [];
let customerIdCounter = 1;

// Create a new customer
exports.createCustomer = async (req, res) => {
  try {
    // Basic validation (skip complex schema for now)
    const { name, email, phone, address, date_of_birth, id_number } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: 'Name and email are required'
      });
    }

    // Check if customer exists in fallback storage
    const existingCustomer = customers.find(c => c.email === email);
    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        error: 'Customer with this email already exists'
      });
    }

    let newCustomer = null;
    let storage = 'unknown';

    // Try database first
    try {
      const { data: dbCustomer, error } = await supabaseAdmin
        .from('customers')
        .insert([{
          name,
          email,
          phone,
          address,
          date_of_birth,
          id_number,
          status: 'active'
        }])
        .select()
        .single();

      if (!error && dbCustomer) {
        newCustomer = dbCustomer;
        storage = 'database';
      }
    } catch (dbError) {
      console.log('Database customer creation failed, using fallback...');
    }

    // Use fallback if database failed
    if (!newCustomer) {
      newCustomer = {
        id: `customer_${customerIdCounter++}`,
        customer_id: `customer_${customerIdCounter}`,
        name,
        email,
        phone,
        address,
        date_of_birth,
        id_number,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      customers.push(newCustomer);
      storage = 'fallback';
    }

    console.log(`New customer created in ${storage}: ${newCustomer.email}`);

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: newCustomer,
      storage
    });

  } catch (error) {
    logger.error('Create customer error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Get all customers
exports.getCustomers = async (req, res) => {
  try {
    let customerData = [];
    let storage = 'unknown';

    // Try database first
    try {
      const { data: dbCustomers, error } = await supabaseAdmin
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && dbCustomers) {
        customerData = dbCustomers;
        storage = 'database';
      }
    } catch (dbError) {
      console.log('Database customers fetch failed, using fallback...');
    }

    // Use fallback if database failed
    if (customerData.length === 0) {
      customerData = customers;
      storage = 'fallback';
    }

    res.json({
      success: true,
      message: 'Customers retrieved successfully',
      data: customerData,
      storage,
      count: customerData.length
    });

  } catch (error) {
    logger.error('Get customers error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Get customer by ID
exports.getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    let customer = null;
    let storage = 'unknown';

    // Try database first
    try {
      const { data: dbCustomer, error } = await supabaseAdmin
        .from('customers')
        .select('*')
        .eq('customer_id', id)
        .single();

      if (!error && dbCustomer) {
        customer = dbCustomer;
        storage = 'database';
      }
    } catch (dbError) {
      // Try fallback storage
      const fallbackCustomer = customers.find(c => c.id === id || c.customer_id === id);
      if (fallbackCustomer) {
        customer = fallbackCustomer;
        storage = 'fallback';
      }
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    res.json({
      success: true,
      data: customer,
      storage
    });

  } catch (error) {
    logger.error('Get customer by ID error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Update customer
exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { error: validationError, value } = customerUpdateSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError.details[0].message });
    }
    // Prevent updating to duplicate phone/email
    if (value.phone || value.email) {
      const { data: existing } = await supabase
        .from('customers')
        .select('customer_id')
        .or(`phone.eq.${value.phone || ''},email.eq.${value.email || ''}`)
        .neq('customer_id', id)
        .maybeSingle();
      if (existing) {
        return res.status(409).json({ success: false, error: 'Phone or email already exists.' });
      }
    }
    const { data, error } = await supabase
      .from('customers')
      .update({ ...value, updated_at: new Date().toISOString() })
      .eq('customer_id', id)
      .select()
      .single();
    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Customer not found or update failed' });
    }
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error('Update customer error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Deactivate (soft delete) customer
exports.deactivateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('customers')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('customer_id', id)
      .select()
      .single();
    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Customer not found or already inactive' });
    }
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error('Deactivate customer error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}; 