const express = require('express');
const authService = require('../services/auth.service');
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

module.exports = router;


