const express = require('express');
const authService = require('../services/auth.service');
const { z } = require('zod');

const router = express.Router();

// ✅ EXPLICIT OPTIONS HANDLER for Google OAuth (prevents cold start CORS issues)
router.options('/google/url', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.sendStatus(204);
});

// Get Google OAuth URL
router.get('/google/url', async (req, res) => {
  try {
    // ✅ EXPLICIT CORS HEADERS (defense in depth for Render cold starts)
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    const url = authService.getGoogleAuthUrl();
    res.json({ success: true, url });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// ✅ EXPLICIT OPTIONS HANDLER for Google OAuth callback
router.options('/google/callback', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.sendStatus(204);
});

// Handle Google OAuth callback
router.post('/google/callback', async (req, res) => {
  try {
    // ✅ EXPLICIT CORS HEADERS
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
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
