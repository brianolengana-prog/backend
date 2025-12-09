const express = require('express');
const authService = require('../services/auth.service');
const { z } = require('zod');

const router = express.Router();

// ✅ EXPLICIT OPTIONS HANDLER for Google OAuth (prevents cold start CORS issues)
router.options('/google/url', (req, res) => {
  // ✅ SECURITY: Only allow specific origins, never wildcard
  const allowedOrigin = req.headers.origin;
  const env = require('../config/env');
  const allowedOrigins = [
    env.FRONTEND_URL,
    'https://www.callsheetconverter.com',
    'https://callsheetconverter.com',
    'https://www.callsheetconvert.com',
    'https://callsheetconvert.com',
  ];
  
  if (allowedOrigin && allowedOrigins.includes(allowedOrigin)) {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
  } else if (process.env.NODE_ENV === 'development' && allowedOrigin?.startsWith('http://localhost:')) {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
  } else {
    // No origin or not allowed - don't set header (browser will block)
    return res.status(403).json({ error: 'CORS policy violation' });
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.sendStatus(204);
});

// Get Google OAuth URL
router.get('/google/url', async (req, res) => {
  try {
    // ✅ EXPLICIT CORS HEADERS (defense in depth for Render cold starts)
    // ✅ SECURITY: Only allow specific origins, never wildcard
  const allowedOrigin = req.headers.origin;
  const env = require('../config/env');
  const allowedOrigins = [
    env.FRONTEND_URL,
    'https://www.callsheetconverter.com',
    'https://callsheetconverter.com',
    'https://www.callsheetconvert.com',
    'https://callsheetconvert.com',
  ];
  
  if (allowedOrigin && allowedOrigins.includes(allowedOrigin)) {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
  } else if (process.env.NODE_ENV === 'development' && allowedOrigin?.startsWith('http://localhost:')) {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
  } else {
    // No origin or not allowed - don't set header (browser will block)
    return res.status(403).json({ error: 'CORS policy violation' });
  }
    res.header('Access-Control-Allow-Credentials', 'true');
    
    const url = authService.getGoogleAuthUrl();
    res.json({ success: true, url });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// ✅ EXPLICIT OPTIONS HANDLER for Google OAuth callback
router.options('/google/callback', (req, res) => {
  // ✅ SECURITY: Only allow specific origins, never wildcard
  const allowedOrigin = req.headers.origin;
  const env = require('../config/env');
  const allowedOrigins = [
    env.FRONTEND_URL,
    'https://www.callsheetconverter.com',
    'https://callsheetconverter.com',
    'https://www.callsheetconvert.com',
    'https://callsheetconvert.com',
  ];
  
  if (allowedOrigin && allowedOrigins.includes(allowedOrigin)) {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
  } else if (process.env.NODE_ENV === 'development' && allowedOrigin?.startsWith('http://localhost:')) {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
  } else {
    // No origin or not allowed - don't set header (browser will block)
    return res.status(403).json({ error: 'CORS policy violation' });
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.sendStatus(204);
});

// Handle Google OAuth callback
router.post('/google/callback', async (req, res) => {
  try {
    // ✅ EXPLICIT CORS HEADERS
    // ✅ SECURITY: Only allow specific origins, never wildcard
  const allowedOrigin = req.headers.origin;
  const env = require('../config/env');
  const allowedOrigins = [
    env.FRONTEND_URL,
    'https://www.callsheetconverter.com',
    'https://callsheetconverter.com',
    'https://www.callsheetconvert.com',
    'https://callsheetconvert.com',
  ];
  
  if (allowedOrigin && allowedOrigins.includes(allowedOrigin)) {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
  } else if (process.env.NODE_ENV === 'development' && allowedOrigin?.startsWith('http://localhost:')) {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
  } else {
    // No origin or not allowed - don't set header (browser will block)
    return res.status(403).json({ error: 'CORS policy violation' });
  }
    res.header('Access-Control-Allow-Credentials', 'true');
    
    const schema = z.object({ code: z.string().min(1) });
    const { code } = schema.parse(req.body);
    const result = await authService.handleGoogle(code);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

module.exports = router;
