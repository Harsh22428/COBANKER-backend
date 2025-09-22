const express = require('express');
const { createCustomer, getCustomers, getCustomerById } = require('../controllers/customerController');

const router = express.Router();

// Get all customers
router.get('/', getCustomers);

// Create customer
router.post('/', createCustomer);

// Get customer by ID
router.get('/:id', getCustomerById);

module.exports = router;