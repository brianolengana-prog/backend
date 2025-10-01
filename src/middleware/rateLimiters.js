const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });
const extractionLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
const billingLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40 });

module.exports = { authLimiter, extractionLimiter, billingLimiter };


