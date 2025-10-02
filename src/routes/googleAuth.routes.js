const express = require('express');
const authService = require('../services/auth.service');
const { z } = require('zod');

const router = express.Router();

// Get Google OAuth URL
router.get('/google/url', async (req, res) => {
  try {
    const url = authService.getGoogleAuthUrl();
    res.json({ success: true, url });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Handle Google OAuth callback
router.post('/google/callback', async (req, res) => {
  try {
    const schema = z.object({ code: z.string().min(1) });
    const { code } = schema.parse(req.body);
    const result = await authService.handleGoogle(code);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

module.exports = router;
