/**
 * Auth Routes (New Domain-Driven Version)
 * 
 * Routes using the new AuthService from domains/auth
 * Maintains backward compatibility with existing API
 * 
 * Best Practice: Routes layer - thin, delegates to services
 */
const express = require('express');
const AuthService = require('../services/AuthService');
const { authenticateToken } = require('../../../middleware/auth');
const { z } = require('zod');
const featureFlags = require('../../../shared/infrastructure/features/feature-flags.service');
const { logger } = require('../../../shared/infrastructure/logger/logger.service');

const router = express.Router();

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const googleCallbackSchema = z.object({
  code: z.string().min(1)
});

// Create AuthService instance
const authService = new AuthService();

/**
 * POST /api/auth/register
 * Register new user with email/password
 */
router.post('/register', async (req, res) => {
  try {
    const body = registerSchema.parse(req.body);
    const result = await authService.register(body);

    if (result.isSuccess()) {
      // Return in format expected by frontend
      const response = result.toObject();
      res.json({
        success: true,
        user: response.user,
        token: response.token,
        refreshToken: response.refreshToken,
        session: response.session
      });
    } else {
      res.status(400).json(result.toObject());
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    } else {
      logger.error('Registration error', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: 'Registration failed'
      });
    }
  }
});

/**
 * POST /api/auth/login
 * Login with email/password
 */
router.post('/login', async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await authService.login(body);

    if (result.isSuccess()) {
      // Return in format expected by frontend
      const response = result.toObject();
      res.json({
        success: true,
        user: response.user,
        token: response.token,
        refreshToken: response.refreshToken,
        session: response.session
      });
    } else {
      res.status(401).json(result.toObject());
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    } else {
      logger.error('Login error', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: 'Login failed'
      });
    }
  }
});

/**
 * POST /api/auth/google/callback
 * Google OAuth callback
 */
router.post('/google/callback', async (req, res) => {
  try {
    const body = googleCallbackSchema.parse(req.body);
    const result = await authService.authenticateWithGoogle(body);

    if (result.isSuccess()) {
      // Return in format expected by frontend (Google OAuth)
      const response = result.toObject();
      res.json({
        success: true,
        user: response.user,
        token: response.token,
        refreshToken: response.refreshToken,
        session: response.session
      });
    } else {
      res.status(400).json(result.toObject());
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    } else {
      logger.error('Google OAuth error', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: 'Google authentication failed'
      });
    }
  }
});

/**
 * GET /api/auth/google/url
 * Get Google OAuth authorization URL
 */
router.get('/google/url', (req, res) => {
  try {
    const url = authService.getGoogleAuthUrl();
    res.json({
      success: true,
      url
    });
  } catch (error) {
    logger.error('Google auth URL error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to generate Google auth URL'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // User is attached by authenticateToken middleware
    const user = req.user;
    
    // Sanitize user data (remove sensitive fields)
    const sanitized = {
      id: user.id,
      email: user.email,
      name: user.name,
      provider: user.provider,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.json({
      success: true,
      user: sanitized
    });
  } catch (error) {
    logger.error('Get user error', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Failed to get user information'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout current user
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // TODO: Implement session invalidation
    // For now, just return success
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

/**
 * GET /api/auth/health
 * Health check for auth service
 */
router.get('/health', (req, res) => {
  try {
    const health = authService.getHealthStatus();
    res.json({
      success: true,
      ...health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Auth service unhealthy'
    });
  }
});

module.exports = router;

