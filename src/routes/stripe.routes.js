const express = require('express');
const billingRoutes = require('./billing.routes');

const router = express.Router();

// Redirect all Stripe routes to billing routes for compatibility
router.use('/', billingRoutes);

module.exports = router;
