require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// In-memory storage
let users = [];
let customers = [];
let accounts = [];
let transactions = [];
let userIdCounter = 1;
let customerIdCounter = 1;
let accountIdCounter = 1;
let transactionIdCounter = 1;

// Simple auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🎉 CoBanker Stable Backend',
    status: 'success',
    timestamp: new Date().toISOString(),
    version: 'v1',
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth/*',
      customers: '/api/v1/customers/*',
      accounts: '/api/v1/accounts/*',
      transactions: '/api/v1/transactions/*'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    database: 'in-memory'
  });
});

// AUTH ROUTES
// Register user
app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { email, password, name, role = 'customer' } = req.body;

    // Basic validation
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and name are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    // Check if user exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create user
    const newUser = {
      id: `user_${userIdCounter++}`,
      email,
      password_hash,
      name,
      role,
      is_active: true,
      created_at: new Date().toISOString()
    };

    users.push(newUser);

    const { password_hash: _, ...userWithoutPassword } = newUser;

    console.log(`New user registered: ${email}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { user: userWithoutPassword }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Login user
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        user_id: user.id,
        userId: user.id,
        email: user.email,
        role: user.role,
        bank_id: user.bank_id,
        branch_id: user.branch_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Remove password from response
    const { password_hash, ...userWithoutPassword } = user;

    console.log(`User logged in: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        token,
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get current user
app.get('/api/v1/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = users.find(u => u.id === req.user.user_id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: userWithoutPassword
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// CUSTOMER ENDPOINTS
// Get all customers
app.get('/api/v1/customers', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Customers retrieved successfully',
      data: customers,
      count: customers.length
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create customer
app.post('/api/v1/customers', authenticateToken, async (req, res) => {
  try {
    const { name, email, phone, address, date_of_birth, id_number } = req.body;

    // Basic validation
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: 'Name and email are required'
      });
    }

    // Check if customer exists
    const existingCustomer = customers.find(c => c.email === email);
    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        error: 'Customer with this email already exists'
      });
    }

    // Create customer
    const newCustomer = {
      id: `customer_${customerIdCounter++}`,
      name,
      email,
      phone,
      address,
      date_of_birth,
      id_number,
      status: 'active',
      bank_id: req.user.bank_id,
      branch_id: req.user.branch_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    customers.push(newCustomer);

    console.log(`New customer created: ${newCustomer.email}`);

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: newCustomer
    });

  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get customer by ID
app.get('/api/v1/customers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const customer = customers.find(c => c.id === id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    res.json({
      success: true,
      data: customer
    });

  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ACCOUNT ENDPOINTS
// Get all accounts
app.get('/api/v1/accounts', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Accounts retrieved successfully',
      data: accounts,
      count: accounts.length
    });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create account
app.post('/api/v1/accounts', authenticateToken, async (req, res) => {
  try {
    const { customer_id, account_type = 'savings', initial_deposit = 0 } = req.body;

    // Basic validation
    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID is required'
      });
    }

    // Verify customer exists
    const customer = customers.find(c => c.id === customer_id);
    if (!customer) {
      return res.status(400).json({
        success: false,
        error: 'Customer not found'
      });
    }

    // Generate account number
    const accountNumber = `ACC${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Create account
    const newAccount = {
      id: `account_${accountIdCounter++}`,
      customer_id,
      account_number: accountNumber,
      account_type,
      balance: parseFloat(initial_deposit),
      status: 'active',
      bank_id: req.user.bank_id,
      branch_id: req.user.branch_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    accounts.push(newAccount);

    console.log(`New account created: ${newAccount.account_number}`);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: newAccount
    });

  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get account by ID
app.get('/api/v1/accounts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const account = accounts.find(a => a.id === id);

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    res.json({
      success: true,
      data: account
    });

  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// TRANSACTION ENDPOINTS
// Create transaction
app.post('/api/v1/transactions', authenticateToken, async (req, res) => {
  try {
    const { account_id, type, amount, description = '' } = req.body;

    // Basic validation
    if (!account_id || !type || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Account ID, type, and amount are required'
      });
    }

    if (!['deposit', 'withdrawal', 'transfer'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Transaction type must be deposit, withdrawal, or transfer'
      });
    }

    const transactionAmount = parseFloat(amount);
    if (transactionAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than 0'
      });
    }

    // Find account
    const account = accounts.find(a => a.id === account_id);
    if (!account) {
      return res.status(400).json({
        success: false,
        error: 'Account not found'
      });
    }

    // Calculate new balance
    let newBalance = account.balance;
    if (type === 'deposit') {
      newBalance += transactionAmount;
    } else if (type === 'withdrawal') {
      if (account.balance < transactionAmount) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient funds'
        });
      }
      newBalance -= transactionAmount;
    }

    // Create transaction record
    const newTransaction = {
      id: `transaction_${transactionIdCounter++}`,
      account_id,
      type,
      amount: transactionAmount,
      description,
      balance_before: account.balance,
      balance_after: newBalance,
      status: 'completed',
      created_at: new Date().toISOString()
    };

    transactions.push(newTransaction);

    // Update account balance
    account.balance = newBalance;
    account.updated_at = new Date().toISOString();

    console.log(`New transaction created: ${type} of ${transactionAmount} for account ${account_id}`);

    res.status(201).json({
      success: true,
      message: 'Transaction completed successfully',
      data: newTransaction,
      account_balance: newBalance
    });

  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get transactions for an account
app.get('/api/v1/accounts/:id/transactions', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Filter transactions for this account
    const accountTransactions = transactions.filter(t => t.account_id === id);

    res.json({
      success: true,
      message: 'Transactions retrieved successfully',
      data: accountTransactions,
      count: accountTransactions.length
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(' CoBanker Stable Backend Started!');
  console.log('===================================');
  console.log(` Server: http://localhost:${PORT}`);
  console.log(` Health: http://localhost:${PORT}/health`);
  console.log('');
  console.log(' AUTHENTICATION ENDPOINTS:');
  console.log(`   POST http://localhost:${PORT}/api/v1/auth/register`);
  console.log(`   POST http://localhost:${PORT}/api/v1/auth/login`);
  console.log(`   GET  http://localhost:${PORT}/api/v1/auth/me`);
  console.log('');
  console.log(' CUSTOMER ENDPOINTS:');
  console.log(`   GET  http://localhost:${PORT}/api/v1/customers`);
  console.log(`   POST http://localhost:${PORT}/api/v1/customers`);
  console.log(`   GET  http://localhost:${PORT}/api/v1/customers/:id`);
  console.log('');
  console.log(' ACCOUNT ENDPOINTS:');
  console.log(`   GET  http://localhost:${PORT}/api/v1/accounts`);
  console.log(`   POST http://localhost:${PORT}/api/v1/accounts`);
  console.log(`   GET  http://localhost:${PORT}/api/v1/accounts/:id`);
  console.log('');
  console.log(' TRANSACTION ENDPOINTS:');
  console.log(`   POST http://localhost:${PORT}/api/v1/transactions`);
  console.log(`   GET  http://localhost:${PORT}/api/v1/accounts/:id/transactions`);
  console.log('');
  console.log(' STABLE IN-MEMORY STORAGE');
  console.log(' ALL ENDPOINTS WORKING');
  console.log(' READY FOR POSTMAN TESTING!');
});

module.exports = app;
