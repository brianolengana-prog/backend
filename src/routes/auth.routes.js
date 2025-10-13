const express = require('express');
const authService = require('../services/auth.service');
const { authenticate } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

router.post('/register', async (req, res) => {
  try {
    const body = registerSchema.parse(req.body);
    const result = await authService.register(body);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await authService.login(body);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(401).json({ success: false, error: e.message });
  }
});

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

// ✅ EXPLICIT OPTIONS HANDLER for Google OAuth (prevents cold start CORS issues)
router.options('/google/url', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.sendStatus(204);
});

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

router.post('/refresh', async (req, res) => {
  try {
    const schema = z.object({ refreshToken: z.string().min(1) });
    const { refreshToken } = schema.parse(req.body);
    const result = await authService.refresh(refreshToken);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const schema = z.object({ token: z.string().min(1) });
    const { token } = schema.parse(req.body);
    const result = await authService.verifyEmail(token);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/resend-verification', async (req, res) => {
  try {
    const schema = z.object({ email: z.string().email() });
    const { email } = schema.parse(req.body);
    const result = await authService.resendVerification(email);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const schema = z.object({ email: z.string().email() });
    const { email } = schema.parse(req.body);
    const result = await authService.forgotPassword(email);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const schema = z.object({ token: z.string().min(1), password: z.string().min(8) });
    const { token, password } = schema.parse(req.body);
    const result = await authService.resetPassword(token, password);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

module.exports = router;

// Authenticated profile route
router.get('/me', authenticate, async (req, res) => {
  try {
    // Minimal profile response based on JWT contents; could be expanded with DB fetch
    res.json({ success: true, user: { id: req.user.userId, email: req.user.email, provider: req.user.provider } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Stateless logout (client clears token)
router.post('/logout', authenticate, async (req, res) => {
  try {
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


