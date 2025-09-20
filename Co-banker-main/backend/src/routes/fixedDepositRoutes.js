const express = require('express');
const {
  createFixedDeposit,
  getFixedDepositById,
  getFixedDepositsByCustomer,
  updateFixedDeposit,
  matureFixedDeposit,
  getFixedDepositStats,
} = require('../controllers/fixedDepositController');

const { authenticateToken } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validationMiddleware');
const { fdCreateSchema, fdUpdateSchema } = require('../validators/fixedDepositValidator');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// @route   POST /api/v1/fixed-deposits
// @desc    Create a new fixed deposit
// @access  Private (Bank/Branch employees)
router.post('/', validateRequest(fdCreateSchema), createFixedDeposit);

// @route   GET /api/v1/fixed-deposits/stats
// @desc    Get fixed deposit statistics
// @access  Private (Bank employees)
router.get('/stats', getFixedDepositStats);

// @route   GET /api/v1/fixed-deposits/:id
// @desc    Get fixed deposit by ID
// @access  Private
router.get('/:id', getFixedDepositById);

// @route   GET /api/v1/fixed-deposits/customer/:customerId
// @desc    Get fixed deposits by customer ID
// @access  Private
router.get('/customer/:customerId', getFixedDepositsByCustomer);

// @route   PUT /api/v1/fixed-deposits/:id
// @desc    Update fixed deposit
// @access  Private (Bank/Branch employees)
router.put('/:id', validateRequest(fdUpdateSchema), updateFixedDeposit);

// @route   PATCH /api/v1/fixed-deposits/:id/mature
// @desc    Mature fixed deposit
// @access  Private (Bank/Branch employees)
router.patch('/:id/mature', matureFixedDeposit);

module.exports = router;
