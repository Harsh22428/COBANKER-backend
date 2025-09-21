const express = require('express');
const {
  createAccount,
  getAccounts,
  getAccountById,
} = require('../controllers/accountController');

const router = express.Router();

// Get all accounts
router.get('/', getAccounts);

// Create account
router.post('/', createAccount);

// Get account by ID
router.get('/:id', getAccountById);

module.exports = router;