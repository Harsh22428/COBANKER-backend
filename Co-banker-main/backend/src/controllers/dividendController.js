const { Dividend, DIVIDEND_TYPES, DIVIDEND_STATUS } = require('../models/Dividend');
const { logger } = require('../utils/logger');
const { supabase } = require('../config/database');

// @desc    Declare a new dividend
// @route   POST /api/v1/dividends
// @access  Private (Admin/Board members only)
const declareDividend = async (req, res) => {
  try {
    const {
      dividend_year,
      dividend_type,
      dividend_rate,
      record_date,
      payment_date,
      description,
      board_resolution_number,
    } = req.body;

    // Only admin or board members can declare dividends
    if (!['admin', 'board_member'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Only admin or board members can declare dividends',
      });
    }

    const dividendData = {
      dividend_year,
      dividend_type,
      dividend_rate,
      record_date,
      payment_date,
      description,
      board_resolution_number,
      bank_id: req.user.bank_id,
    };

    const dividend = await Dividend.create(dividendData);

    res.status(201).json({
      success: true,
      message: 'Dividend declared successfully',
      data: dividend.getSummary(),
    });
  } catch (error) {
    logger.error('Dividend declaration controller error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get dividend by ID
// @route   GET /api/v1/dividends/:id
// @access  Private
const getDividendById = async (req, res) => {
  try {
    const { id } = req.params;

    const dividend = await Dividend.findById(id);

    if (!dividend) {
      return res.status(404).json({
        success: false,
        error: 'Dividend not found',
      });
    }

    // Check if user has access to this dividend
    if (req.user.role !== 'admin' && 
        dividend.bank_id !== req.user.bank_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    res.status(200).json({
      success: true,
      data: dividend,
    });
  } catch (error) {
    logger.error('Get dividend by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

// @desc    Get all dividends
// @route   GET /api/v1/dividends
// @access  Private
const getDividends = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      dividend_year, 
      dividend_type, 
      status 
    } = req.query;

    const filters = {};
    if (dividend_year) filters.dividend_year = parseInt(dividend_year);
    if (dividend_type) filters.dividend_type = dividend_type;
    if (status) filters.status = status;

    const dividends = await Dividend.findByBankId(req.user.bank_id, filters);

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedDividends = dividends.slice(startIndex, endIndex);

    const totalPages = Math.ceil(dividends.length / limit);

    res.status(200).json({
      success: true,
      data: paginatedDividends,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: dividends.length,
        totalPages,
      },
    });
  } catch (error) {
    logger.error('Get dividends error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

// @desc    Update dividend
// @route   PUT /api/v1/dividends/:id
// @access  Private (Admin/Board members only)
const updateDividend = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Only admin or board members can update dividends
    if (!['admin', 'board_member'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Only admin or board members can update dividends',
      });
    }

    const dividend = await Dividend.findById(id);

    if (!dividend) {
      return res.status(404).json({
        success: false,
        error: 'Dividend not found',
      });
    }

    // Check if user has access to this dividend
    if (req.user.role !== 'admin' && 
        dividend.bank_id !== req.user.bank_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const updatedDividend = await dividend.update(updateData);

    res.status(200).json({
      success: true,
      message: 'Dividend updated successfully',
      data: updatedDividend,
    });
  } catch (error) {
    logger.error('Update dividend error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Approve dividend
// @route   PATCH /api/v1/dividends/:id/approve
// @access  Private (Admin/Board members only)
const approveDividend = async (req, res) => {
  try {
    const { id } = req.params;

    // Only admin or board members can approve dividends
    if (!['admin', 'board_member'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Only admin or board members can approve dividends',
      });
    }

    const dividend = await Dividend.findById(id);

    if (!dividend) {
      return res.status(404).json({
        success: false,
        error: 'Dividend not found',
      });
    }

    // Check if user has access to this dividend
    if (req.user.role !== 'admin' && 
        dividend.bank_id !== req.user.bank_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const approvedDividend = await dividend.approve();

    res.status(200).json({
      success: true,
      message: 'Dividend approved successfully',
      data: approvedDividend.getSummary(),
    });
  } catch (error) {
    logger.error('Approve dividend error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Distribute dividend to members
// @route   PATCH /api/v1/dividends/:id/distribute
// @access  Private (Admin only)
const distributeDividend = async (req, res) => {
  try {
    const { id } = req.params;

    // Only admin can distribute dividends
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin can distribute dividends',
      });
    }

    const dividend = await Dividend.findById(id);

    if (!dividend) {
      return res.status(404).json({
        success: false,
        error: 'Dividend not found',
      });
    }

    // Check if user has access to this dividend
    if (dividend.bank_id !== req.user.bank_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const distributionResult = await dividend.distribute();

    res.status(200).json({
      success: true,
      message: 'Dividend distributed successfully',
      data: {
        dividend_number: dividend.dividend_number,
        ...distributionResult,
      },
    });
  } catch (error) {
    logger.error('Distribute dividend error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get dividend distributions
// @route   GET /api/v1/dividends/:id/distributions
// @access  Private
const getDividendDistributions = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const dividend = await Dividend.findById(id);

    if (!dividend) {
      return res.status(404).json({
        success: false,
        error: 'Dividend not found',
      });
    }

    // Check if user has access to this dividend
    if (req.user.role !== 'admin' && 
        dividend.bank_id !== req.user.bank_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const distributions = await dividend.getDistributions();

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedDistributions = distributions.slice(startIndex, endIndex);

    const totalPages = Math.ceil(distributions.length / limit);

    res.status(200).json({
      success: true,
      data: paginatedDistributions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: distributions.length,
        totalPages,
      },
    });
  } catch (error) {
    logger.error('Get dividend distributions error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

// @desc    Cancel dividend
// @route   PATCH /api/v1/dividends/:id/cancel
// @access  Private (Admin/Board members only)
const cancelDividend = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Cancellation reason is required',
      });
    }

    // Only admin or board members can cancel dividends
    if (!['admin', 'board_member'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Only admin or board members can cancel dividends',
      });
    }

    const dividend = await Dividend.findById(id);

    if (!dividend) {
      return res.status(404).json({
        success: false,
        error: 'Dividend not found',
      });
    }

    // Check if user has access to this dividend
    if (req.user.role !== 'admin' && 
        dividend.bank_id !== req.user.bank_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const cancelledDividend = await dividend.cancel(reason);

    res.status(200).json({
      success: true,
      message: 'Dividend cancelled successfully',
      data: cancelledDividend.getSummary(),
    });
  } catch (error) {
    logger.error('Cancel dividend error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get dividend statistics
// @route   GET /api/v1/dividends/stats
// @access  Private (Admin/Board members)
const getDividendStats = async (req, res) => {
  try {
    const { bank_id } = req.user;
    const { year } = req.query;

    let filters = {};
    if (year) filters.dividend_year = parseInt(year);

    const dividends = await Dividend.findByBankId(bank_id, filters);

    // Calculate statistics
    const stats = {
      total_dividends: dividends.length,
      total_amount_declared: dividends.reduce((sum, d) => sum + (d.total_dividend_amount || 0), 0),
      by_status: {},
      by_type: {},
      by_year: {},
    };

    // Group by status
    dividends.forEach(dividend => {
      if (!stats.by_status[dividend.status]) {
        stats.by_status[dividend.status] = {
          count: 0,
          total_amount: 0,
        };
      }
      stats.by_status[dividend.status].count++;
      stats.by_status[dividend.status].total_amount += dividend.total_dividend_amount || 0;
    });

    // Group by type
    dividends.forEach(dividend => {
      if (!stats.by_type[dividend.dividend_type]) {
        stats.by_type[dividend.dividend_type] = {
          count: 0,
          total_amount: 0,
        };
      }
      stats.by_type[dividend.dividend_type].count++;
      stats.by_type[dividend.dividend_type].total_amount += dividend.total_dividend_amount || 0;
    });

    // Group by year
    dividends.forEach(dividend => {
      if (!stats.by_year[dividend.dividend_year]) {
        stats.by_year[dividend.dividend_year] = {
          count: 0,
          total_amount: 0,
        };
      }
      stats.by_year[dividend.dividend_year].count++;
      stats.by_year[dividend.dividend_year].total_amount += dividend.total_dividend_amount || 0;
    });

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Get dividend stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

module.exports = {
  declareDividend,
  getDividendById,
  getDividends,
  updateDividend,
  approveDividend,
  distributeDividend,
  getDividendDistributions,
  cancelDividend,
  getDividendStats,
};
