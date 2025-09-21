const { logger } = require('../utils/logger');
const { supabase, supabaseAdmin } = require('../config/database');

// In-memory fallback storage
let accounts = [];
let accountIdCounter = 1;

// Create a new account
const createAccount = async (req, res) => {
  try {
    const { customer_id, account_type = 'savings', initial_deposit = 0 } = req.body;

    // Basic validation
    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID is required'
      });
    }

    // Verify customer exists (check fallback first)
    const fallbackCustomer = require('./customerController').customers?.find(c => c.id === customer_id);
    let customerExists = !!fallbackCustomer;

    if (!customerExists) {
      try {
        const { data: dbCustomer } = await supabaseAdmin
          .from('customers')
          .select('id')
          .eq('id', customer_id)
          .single();

        if (dbCustomer) customerExists = true;
      } catch (dbError) {
        console.log('Customer not found in database');
      }
    }

    if (!customerExists) {
      return res.status(400).json({
        success: false,
        error: 'Customer not found'
      });
    }

    // Generate account number
    const accountNumber = `ACC${Date.now()}${Math.floor(Math.random() * 1000)}`;

    let newAccount = null;
    let storage = 'unknown';

    // Try database first
    try {
      const { data: dbAccount, error } = await supabaseAdmin
        .from('accounts')
        .insert([{
          customer_id,
          account_number: accountNumber,
          account_type,
          balance: parseFloat(initial_deposit),
          status: 'active'
        }])
        .select()
        .single();

      if (!error && dbAccount) {
        newAccount = dbAccount;
        storage = 'database';
      }
    } catch (dbError) {
      console.log('Database account creation failed, using fallback...');
    }

    // Use fallback if database failed
    if (!newAccount) {
      newAccount = {
        id: `account_${accountIdCounter++}`,
        customer_id,
        account_number: accountNumber,
        account_type,
        balance: parseFloat(initial_deposit),
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      accounts.push(newAccount);
      storage = 'fallback';
    }

    console.log(`New account created in ${storage}: ${newAccount.account_number}`);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: newAccount,
      storage
    });

  } catch (error) {
    logger.error('Account creation controller error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

// Get all accounts
const getAccounts = async (req, res) => {
  try {
    let accountData = [];
    let storage = 'unknown';

    // Try database first
    try {
      const { data: dbAccounts, error } = await supabaseAdmin
        .from('accounts')
        .select('*')
        .limit(50);

      if (!error && dbAccounts) {
        accountData = dbAccounts;
        storage = 'database';
      }
    } catch (dbError) {
      console.log('Database accounts fetch failed, using fallback...');
    }

    // Use fallback if database failed
    if (accountData.length === 0) {
      accountData = accounts;
      storage = 'fallback';
    }

    res.json({
      success: true,
      message: 'Accounts retrieved successfully',
      data: accountData,
      storage,
      count: accountData.length
    });

  } catch (error) {
    logger.error('Get accounts error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// Get account by ID
const getAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    let account = null;
    let storage = 'unknown';

    // Try database first
    try {
      const { data: dbAccount, error } = await supabaseAdmin
        .from('accounts')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && dbAccount) {
        account = dbAccount;
        storage = 'database';
      }
    } catch (dbError) {
      // Try fallback storage
      const fallbackAccount = accounts.find(a => a.id === id);
      if (fallbackAccount) {
        account = fallbackAccount;
        storage = 'fallback';
      }
    }

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    res.json({
      success: true,
      data: account,
      storage
    });

  } catch (error) {
    logger.error('Get account by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

module.exports = {
  createAccount,
  getAccounts,
  getAccountById,
};

