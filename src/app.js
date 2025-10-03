const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { requestId } = require('./middleware/requestId');
const { notFound, errorHandler } = require('./middleware/error');
const { authLimiter, extractionLimiter, billingLimiter } = require('./middleware/rateLimiters');
const env = require('./config/env');
const db = require('./config/database');
const fs = require('fs');
const path = require('path');
const authRoutes = require('./routes/auth.routes');
const googleAuthRoutes = require('./routes/googleAuth.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const billingRoutes = require('./routes/billing.routes');
const stripeRoutes = require('./routes/stripe.routes');
const extractionRoutes = require('./routes/extraction.routes');
const usageRoutes = require('./routes/usage.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const upgradeWorkflowRoutes = require('./routes/upgradeWorkflow.routes');
const contactsRoutes = require('./routes/contacts.routes');

const app = express();

// Trust proxy for rate limiting behind reverse proxy (Render, Vercel, etc.)
app.set('trust proxy', 1);

app.use(helmet());
// CORS configuration for production
const allowedOrigins = [
  env.FRONTEND_URL,
  'https://www.callsheetconverter.com',
  'https://callsheetconverter.com',
  'https://www.callsheetconvert.com',
  'https://callsheetconvert.com',
  'https://sjcallsheets-project.vercel.app',
  'https://sjcallsheets-project-*.vercel.app',
  'https://*.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173'
];

app.use(cors({ 
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Check for Vercel wildcard patterns
    if (origin && origin.match(/^https:\/\/.*\.vercel\.app$/)) {
      return callback(null, true);
    }
    
    // For development, allow localhost with any port
    if (origin && origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    
    console.log('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control', 'Pragma', 'Expires', 'X-Timestamp']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(requestId);

// Ensure uploads directory exists for disk storage
const uploadsDir = path.join(process.cwd(), 'backend-clean', 'uploads');
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch {}

app.get('/', (req, res) => {
  res.json({ status: 'OK', service: 'Clean Backend', ts: new Date().toISOString() });
});

app.get('/api/health', async (req, res) => {
  try {
    await db.connect();
    await db.getClient().$queryRaw`SELECT 1`;
    res.json({ status: 'OK' });
  } catch (e) {
    res.status(500).json({ status: 'ERROR', error: e.message });
  }
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/google-auth', authLimiter, googleAuthRoutes);
app.use('/api/subscription', billingLimiter, subscriptionRoutes);
app.use('/api/billing', billingLimiter, billingRoutes);
app.use('/api/stripe', billingLimiter, stripeRoutes);
app.use('/api/extraction', extractionLimiter, extractionRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/upgrade', upgradeWorkflowRoutes);
app.use('/api/contacts', contactsRoutes);

app.use(notFound);
app.use(errorHandler);

// Start workers in production OR when explicitly enabled
console.log('🔍 Environment check:', {
  NODE_ENV: process.env.NODE_ENV,
  isProduction: process.env.NODE_ENV === 'production',
  ENABLE_WORKERS: process.env.ENABLE_WORKERS
});

const shouldStartWorkers = process.env.NODE_ENV === 'production' || process.env.ENABLE_WORKERS === 'true';

if (shouldStartWorkers) {
  console.log('🚀 Starting workers...');
  const workerManager = require('./workers/workerManager');
  
  // Start workers after a short delay to ensure app is ready
  setTimeout(async () => {
    try {
      console.log('⏰ Starting workers after delay...');
      await workerManager.start();
      console.log('✅ Workers started successfully');
    } catch (error) {
      console.error('❌ Failed to start workers:', error);
    }
  }, 2000);
} else {
  console.log('⚠️ Workers not started - set ENABLE_WORKERS=true to start in development');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down workers...');
  if (shouldStartWorkers) {
    const workerManager = require('./workers/workerManager');
    await workerManager.stop();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down workers...');
  if (shouldStartWorkers) {
    const workerManager = require('./workers/workerManager');
    await workerManager.stop();
  }
  process.exit(0);
});

module.exports = app;


