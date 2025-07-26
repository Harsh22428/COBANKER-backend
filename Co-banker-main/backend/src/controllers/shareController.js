const { Share, SHARE_TYPES, SHARE_STATUS, SHARE_TRANSACTION_TYPES } = require('../models/Share');
const { logger } = require('../utils/logger');
const { supabase } = require('../config/database');

// @desc    Create a new share allocation
// @route   POST /api/v1/shares
// @access  Private (Bank/Branch employees)
const createShare = async (req, res) => {
  try {
    const {
      member_id,
      share_type,
      number_of_shares,
      share_value,
      certificate_number,
      description,
    } = req.body;

    // Add branch_id and bank_id from authenticated user
    const shareData = {
      member_id,
      share_type,
      number_of_shares,
      share_value,
      total_amount: number_of_shares * share_value,
      certificate_number,
      description,
      branch_id: req.user.branch_id,
      bank_id: req.user.bank_id,
    };

    const share = await Share.create(shareData);

    res.status(201).json({
      success: true,
      message: 'Share allocation created successfully',
      data: share.getSummary(),
    });
  } catch (error) {
    logger.error('Share creation controller error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get share by ID
// @route   GET /api/v1/shares/:id
// @access  Private
const getShareById = async (req, res) => {
  try {
    const { id } = req.params;

    const share = await Share.findById(id);

    if (!share) {
      return res.status(404).json({
        success: false,
        error: 'Share not found',
      });
    }

    // Check if user has access to this share
    if (req.user.role !== 'admin' && 
        share.bank_id !== req.user.bank_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    res.status(200).json({
      success: true,
      data: share,
    });
  } catch (error) {
    logger.error('Get share by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

// @desc    Get shares by member ID
// @route   GET /api/v1/shares/member/:memberId
// @access  Private
const getSharesByMember = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { page = 1, limit = 10, status, share_type } = req.query;

    // Check if member exists and user has access
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('member_id, bank_id, branch_id')
      .eq('member_id', memberId)
      .single();

    if (memberError || !member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found',
      });
    }

    // Check access permissions
    if (req.user.role !== 'admin' && 
        member.bank_id !== req.user.bank_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Build query
    let query = supabase
      .from('shares')
      .select(`
        *,
        branches (id, name, address),
        banks (id, name, code)
      `)
      .eq('member_id', memberId);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (share_type) {
      query = query.eq('share_type', share_type);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);
    query = query.order('created_at', { ascending: false });

    const { data: shares, error, count } = await query;

    if (error) {
      throw error;
    }

    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      success: true,
      data: shares.map(share => new Share(share)),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages,
      },
    });
  } catch (error) {
    logger.error('Get shares by member error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

// @desc    Update share
// @route   PUT /api/v1/shares/:id
// @access  Private (Bank/Branch employees)
const updateShare = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const share = await Share.findById(id);

    if (!share) {
      return res.status(404).json({
        success: false,
        error: 'Share not found',
      });
    }

    // Check if user has access to this share
    if (req.user.role !== 'admin' && 
        share.bank_id !== req.user.bank_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const updatedShare = await share.update(updateData);

    res.status(200).json({
      success: true,
      message: 'Share updated successfully',
      data: updatedShare,
    });
  } catch (error) {
    logger.error('Update share error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Transfer shares between members
// @route   POST /api/v1/shares/transfer
// @access  Private (Bank/Branch employees)
const transferShares = async (req, res) => {
  try {
    const {
      from_member_id,
      to_member_id,
      number_of_shares,
      transfer_price,
      transfer_reason,
    } = req.body;

    const transferData = {
      from_member_id,
      to_member_id,
      number_of_shares,
      transfer_price,
      transfer_reason,
    };

    await Share.transfer(transferData);

    res.status(200).json({
      success: true,
      message: 'Share transfer completed successfully',
      data: {
        from_member_id,
        to_member_id,
        number_of_shares,
        transfer_price,
        transfer_date: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Share transfer error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get share statistics
// @route   GET /api/v1/shares/stats
// @access  Private (Bank employees)
const getShareStats = async (req, res) => {
  try {
    const { bank_id } = req.user;
    const { period = 'month' } = req.query;

    // Get share statistics for the bank
    const { data: shares, error } = await supabase
      .from('shares')
      .select('share_type, status, number_of_shares, total_amount, created_at')
      .eq('bank_id', bank_id);

    if (error) {
      throw error;
    }

    // Calculate statistics
    const stats = {
      total_shares: shares.reduce((sum, share) => sum + share.number_of_shares, 0),
      total_value: shares.reduce((sum, share) => sum + share.total_amount, 0),
      active_shares: shares.filter(s => s.status === SHARE_STATUS.ACTIVE).reduce((sum, share) => sum + share.number_of_shares, 0),
      total_members: new Set(shares.map(s => s.member_id)).size,
      by_type: {},
      by_status: {},
    };

    // Group by share type
    shares.forEach(share => {
      if (!stats.by_type[share.share_type]) {
        stats.by_type[share.share_type] = {
          count: 0,
          total_shares: 0,
          total_value: 0,
        };
      }
      stats.by_type[share.share_type].count++;
      stats.by_type[share.share_type].total_shares += share.number_of_shares;
      stats.by_type[share.share_type].total_value += share.total_amount;
    });

    // Group by status
    shares.forEach(share => {
      if (!stats.by_status[share.status]) {
        stats.by_status[share.status] = {
          count: 0,
          total_shares: 0,
        };
      }
      stats.by_status[share.status].count++;
      stats.by_status[share.status].total_shares += share.number_of_shares;
    });

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Get share stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

// @desc    Get share transactions
// @route   GET /api/v1/shares/transactions
// @access  Private
const getShareTransactions = async (req, res) => {
  try {
    const { member_id, transaction_type, page = 1, limit = 10 } = req.query;

    // Build query
    let query = supabase
      .from('share_transactions')
      .select(`
        *,
        members (member_id, name, email)
      `);

    // Apply filters
    if (member_id) {
      query = query.eq('member_id', member_id);
    }
    if (transaction_type) {
      query = query.eq('transaction_type', transaction_type);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);
    query = query.order('transaction_date', { ascending: false });

    const { data: transactions, error, count } = await query;

    if (error) {
      throw error;
    }

    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages,
      },
    });
  } catch (error) {
    logger.error('Get share transactions error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

module.exports = {
  createShare,
  getShareById,
  getSharesByMember,
  updateShare,
  transferShares,
  getShareStats,
  getShareTransactions,
};
