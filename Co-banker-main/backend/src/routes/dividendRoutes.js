const express = require('express');
const {
  declareDividend,
  getDividendById,
  getDividends,
  updateDividend,
  approveDividend,
  distributeDividend,
  getDividendDistributions,
  cancelDividend,
  getDividendStats,
} = require('../controllers/dividendController');

const { authenticateToken } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validationMiddleware');
const { dividendCreateSchema, dividendUpdateSchema } = require('../validators/dividendValidator');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// @route   POST /api/v1/dividends
// @desc    Declare a new dividend
// @access  Private (Admin/Board members only)
router.post('/', validateRequest(dividendCreateSchema), declareDividend);

// @route   GET /api/v1/dividends/stats
// @desc    Get dividend statistics
// @access  Private (Admin/Board members)
router.get('/stats', getDividendStats);

// @route   GET /api/v1/dividends
// @desc    Get all dividends
// @access  Private
router.get('/', getDividends);

// @route   GET /api/v1/dividends/:id
// @desc    Get dividend by ID
// @access  Private
router.get('/:id', getDividendById);

// @route   GET /api/v1/dividends/:id/distributions
// @desc    Get dividend distributions
// @access  Private
router.get('/:id/distributions', getDividendDistributions);

// @route   PUT /api/v1/dividends/:id
// @desc    Update dividend
// @access  Private (Admin/Board members only)
router.put('/:id', validateRequest(dividendUpdateSchema), updateDividend);

// @route   PATCH /api/v1/dividends/:id/approve
// @desc    Approve dividend
// @access  Private (Admin/Board members only)
router.patch('/:id/approve', approveDividend);

// @route   PATCH /api/v1/dividends/:id/distribute
// @desc    Distribute dividend to members
// @access  Private (Admin only)
router.patch('/:id/distribute', distributeDividend);

// @route   PATCH /api/v1/dividends/:id/cancel
// @desc    Cancel dividend
// @access  Private (Admin/Board members only)
router.patch('/:id/cancel', cancelDividend);

module.exports = router;
