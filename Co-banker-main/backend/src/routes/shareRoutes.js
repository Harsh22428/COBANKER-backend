const express = require('express');
const {
  createShare,
  getShareById,
  getSharesByMember,
  updateShare,
  transferShares,
  getShareStats,
  getShareTransactions,
} = require('../controllers/shareController');

const { authenticateToken } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validationMiddleware');
const { shareCreateSchema, shareUpdateSchema, shareTransferSchema } = require('../validators/shareValidator');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// @route   POST /api/v1/shares
// @desc    Create a new share allocation
// @access  Private (Bank/Branch employees)
router.post('/', validateRequest(shareCreateSchema), createShare);

// @route   POST /api/v1/shares/transfer
// @desc    Transfer shares between members
// @access  Private (Bank/Branch employees)
router.post('/transfer', validateRequest(shareTransferSchema), transferShares);

// @route   GET /api/v1/shares/stats
// @desc    Get share statistics
// @access  Private (Bank employees)
router.get('/stats', getShareStats);

// @route   GET /api/v1/shares/transactions
// @desc    Get share transactions
// @access  Private
router.get('/transactions', getShareTransactions);

// @route   GET /api/v1/shares/:id
// @desc    Get share by ID
// @access  Private
router.get('/:id', getShareById);

// @route   GET /api/v1/shares/member/:memberId
// @desc    Get shares by member ID
// @access  Private
router.get('/member/:memberId', getSharesByMember);

// @route   PUT /api/v1/shares/:id
// @desc    Update share
// @access  Private (Bank/Branch employees)
router.put('/:id', validateRequest(shareUpdateSchema), updateShare);

module.exports = router;
