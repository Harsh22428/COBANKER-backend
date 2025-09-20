const { FixedDeposit, FD_TYPES, FD_STATUS } = require('../models/FixedDeposit');
const { logger } = require('../utils/logger');
const { supabase } = require('../config/database');

// @desc    Create a new fixed deposit
// @route   POST /api/v1/fixed-deposits
// @access  Private (Bank/Branch employees)
const createFixedDeposit = async (req, res) => {
  try {
    const {
      customer_id,
      fd_type,
      principal_amount,
      interest_rate,
      tenure_months,
      nominee_name,
      nominee_relationship,
      auto_renewal = false,
      description,
    } = req.body;

    // Add branch_id and bank_id from authenticated user
    const fdData = {
      customer_id,
      fd_type,
      principal_amount,
      interest_rate,
      tenure_months,
      nominee_name,
      nominee_relationship,
      auto_renewal,
      description,
      branch_id: req.user.branch_id,
      bank_id: req.user.bank_id,
    };

    const fixedDeposit = await FixedDeposit.create(fdData);

    res.status(201).json({
      success: true,
      message: 'Fixed Deposit created successfully',
      data: fixedDeposit.getSummary(),
    });
  } catch (error) {
    logger.error('Fixed Deposit creation controller error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get fixed deposit by ID
// @route   GET /api/v1/fixed-deposits/:id
// @access  Private
const getFixedDepositById = async (req, res) => {
  try {
    const { id } = req.params;

    const fixedDeposit = await FixedDeposit.findById(id);

    if (!fixedDeposit) {
      return res.status(404).json({
        success: false,
        error: 'Fixed Deposit not found',
      });
    }

    // Check if user has access to this FD
    if (req.user.role !== 'admin' && 
        fixedDeposit.bank_id !== req.user.bank_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    res.status(200).json({
      success: true,
      data: fixedDeposit,
    });
  } catch (error) {
    logger.error('Get fixed deposit by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

// @desc    Get fixed deposits by customer ID
// @route   GET /api/v1/fixed-deposits/customer/:customerId
// @access  Private
const getFixedDepositsByCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { page = 1, limit = 10, status, fd_type } = req.query;

    // Check if customer exists and user has access
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, bank_id, branch_id')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    // Check access permissions
    if (req.user.role !== 'admin' && 
        customer.bank_id !== req.user.bank_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Build query
    let query = supabase
      .from('fixed_deposits')
      .select(`
        *,
        branches (id, name, address),
        banks (id, name, code)
      `)
      .eq('customer_id', customerId);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (fd_type) {
      query = query.eq('fd_type', fd_type);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);
    query = query.order('created_at', { ascending: false });

    const { data: fixedDeposits, error, count } = await query;

    if (error) {
      throw error;
    }

    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      success: true,
      data: fixedDeposits.map(fd => new FixedDeposit(fd)),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages,
      },
    });
  } catch (error) {
    logger.error('Get fixed deposits by customer error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

// @desc    Update fixed deposit
// @route   PUT /api/v1/fixed-deposits/:id
// @access  Private (Bank/Branch employees)
const updateFixedDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const fixedDeposit = await FixedDeposit.findById(id);

    if (!fixedDeposit) {
      return res.status(404).json({
        success: false,
        error: 'Fixed Deposit not found',
      });
    }

    // Check if user has access to this FD
    if (req.user.role !== 'admin' && 
        fixedDeposit.bank_id !== req.user.bank_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const updatedFixedDeposit = await fixedDeposit.update(updateData);

    res.status(200).json({
      success: true,
      message: 'Fixed Deposit updated successfully',
      data: updatedFixedDeposit,
    });
  } catch (error) {
    logger.error('Update fixed deposit error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Mature fixed deposit
// @route   PATCH /api/v1/fixed-deposits/:id/mature
// @access  Private (Bank/Branch employees)
const matureFixedDeposit = async (req, res) => {
  try {
    const { id } = req.params;

    const fixedDeposit = await FixedDeposit.findById(id);

    if (!fixedDeposit) {
      return res.status(404).json({
        success: false,
        error: 'Fixed Deposit not found',
      });
    }

    // Check if user has access to this FD
    if (req.user.role !== 'admin' && 
        fixedDeposit.bank_id !== req.user.bank_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const maturedFixedDeposit = await fixedDeposit.mature();

    res.status(200).json({
      success: true,
      message: 'Fixed Deposit matured successfully',
      data: maturedFixedDeposit.getSummary(),
    });
  } catch (error) {
    logger.error('Mature fixed deposit error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get fixed deposit statistics
// @route   GET /api/v1/fixed-deposits/stats
// @access  Private (Bank employees)
const getFixedDepositStats = async (req, res) => {
  try {
    const { bank_id } = req.user;
    const { period = 'month' } = req.query;

    // Get FD statistics for the bank
    const { data: fixedDeposits, error } = await supabase
      .from('fixed_deposits')
      .select('fd_type, status, principal_amount, maturity_amount, created_at')
      .eq('bank_id', bank_id);

    if (error) {
      throw error;
    }

    // Calculate statistics
    const stats = {
      total_fds: fixedDeposits.length,
      active_fds: fixedDeposits.filter(fd => fd.status === FD_STATUS.ACTIVE).length,
      matured_fds: fixedDeposits.filter(fd => fd.status === FD_STATUS.MATURED).length,
      total_principal: fixedDeposits.reduce((sum, fd) => sum + (fd.principal_amount || 0), 0),
      total_maturity_value: fixedDeposits.reduce((sum, fd) => sum + (fd.maturity_amount || 0), 0),
      by_type: {},
      by_status: {},
    };

    // Group by FD type
    fixedDeposits.forEach(fd => {
      if (!stats.by_type[fd.fd_type]) {
        stats.by_type[fd.fd_type] = {
          count: 0,
          total_principal: 0,
          total_maturity: 0,
        };
      }
      stats.by_type[fd.fd_type].count++;
      stats.by_type[fd.fd_type].total_principal += fd.principal_amount || 0;
      stats.by_type[fd.fd_type].total_maturity += fd.maturity_amount || 0;
    });

    // Group by status
    fixedDeposits.forEach(fd => {
      if (!stats.by_status[fd.status]) {
        stats.by_status[fd.status] = 0;
      }
      stats.by_status[fd.status]++;
    });

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Get fixed deposit stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

module.exports = {
  createFixedDeposit,
  getFixedDepositById,
  getFixedDepositsByCustomer,
  updateFixedDeposit,
  matureFixedDeposit,
  getFixedDepositStats,
};
