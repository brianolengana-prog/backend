console.log('📦 app.js: Loading dependencies...');
const express = require('express');
console.log('✅ express loaded');
const cors = require('cors');
console.log('✅ cors loaded');
const helmet = require('helmet');
console.log('✅ helmet loaded');
const compression = require('compression');
console.log('✅ compression loaded');
const rateLimit = require('express-rate-limit');
console.log('✅ rateLimit loaded');
const { requestId } = require('./middleware/requestId');
console.log('✅ requestId loaded');
const { notFound, errorHandler } = require('./middleware/error');
console.log('✅ error middleware loaded');
const { authLimiter, extractionLimiter, billingLimiter } = require('./middleware/rateLimiters');
console.log('✅ rateLimiters loaded');
const env = require('./config/env');
console.log('✅ env loaded');
const db = require('./config/database');
console.log('✅ database loaded');
const fs = require('fs');
const path = require('path');
console.log('📦 Loading routes...');
const authRoutes = require('./routes/auth.routes');
// New domain-driven auth routes (feature flag controlled)
let newAuthRoutes = null;
try {
  newAuthRoutes = require('./domains/auth/routes/auth.routes');
} catch (error) {
  console.warn('⚠️ New auth routes not available:', error.message);
}
console.log('✅ auth.routes loaded');
const googleAuthRoutes = require('./routes/googleAuth.routes');
console.log('✅ googleAuth.routes loaded');
const subscriptionRoutes = require('./routes/subscription.routes');
console.log('✅ subscription.routes loaded');
const billingRoutes = require('./routes/billing.routes');
console.log('✅ billing.routes loaded');
const stripeRoutes = require('./routes/stripe.routes');
console.log('✅ stripe.routes loaded');
const extractionRoutes = require('./routes/extraction.routes');
console.log('✅ extraction.routes loaded');
const textExtractionRoutes = require('./routes/textExtraction.routes');
console.log('✅ textExtraction.routes loaded');
const jobsRoutes = require('./routes/jobs.routes');
console.log('✅ jobs.routes loaded');
const usageRoutes = require('./routes/usage.routes');
console.log('✅ usage.routes loaded');
const dashboardRoutes = require('./routes/dashboard.routes');
console.log('✅ dashboard.routes loaded');
const dashboardAggregatedRoutes = require('./routes/dashboard-aggregated.routes');
console.log('✅ dashboard-aggregated.routes loaded');
const dashboardOptimizedRoutes = require('./routes/dashboard-optimized.routes');
console.log('✅ dashboard-optimized.routes loaded');
const upgradeWorkflowRoutes = require('./routes/upgradeWorkflow.routes');
console.log('✅ upgradeWorkflow.routes loaded');
const contactsRoutes = require('./routes/contacts.routes');
console.log('✅ contacts.routes loaded');
const supportRoutes = require('./routes/support.routes');
console.log('✅ support.routes loaded');
const evaluationRoutes = require('./domains/evaluation/routes/evaluation.routes');
console.log('✅ evaluation.routes loaded');
const extractionV2Routes = require('./routes/extraction-v2.routes');
console.log('✅ extraction-v2.routes loaded');
console.log('✅ All routes loaded');

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
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Allow Vercel deployments
    if (origin && origin.match(/^https:\/\/.*\.vercel\.app$/)) return callback(null, true);

    // Allow any localhost port during development
    if (origin && origin.startsWith('http://localhost:')) return callback(null, true);

    console.log('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control', 'Pragma', 'Expires', 'X-Timestamp'],
  optionsSuccessStatus: 204,
  preflightContinue: false
};

app.use(cors(corsOptions));
// Explicitly handle preflight for all routes
app.options('*', cors(corsOptions));
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

// Health check endpoint (both /health and /api/health for compatibility)
const healthCheck = async (req, res) => {
  try {
    await db.connect();
    await db.getClient().$queryRaw`SELECT 1`;
    res.json({ status: 'OK' });
  } catch (e) {
    res.status(500).json({ status: 'ERROR', error: e.message });
  }
};

app.get('/health', healthCheck);
app.get('/api/health', healthCheck);

// Use new auth routes if feature flag enabled, otherwise use legacy
const useNewAuth = process.env.USE_NEW_AUTH === 'true' && newAuthRoutes !== null;

if (useNewAuth) {
  app.use('/api/auth', authLimiter, newAuthRoutes);
  console.log('✅ Using new domain-driven auth routes');
} else {
  app.use('/api/auth', authLimiter, authRoutes);
  if (newAuthRoutes === null) {
    console.log('✅ Using legacy auth routes (new routes not available)');
  } else {
    console.log('✅ Using legacy auth routes (feature flag disabled)');
  }
}
app.use('/api/google-auth', authLimiter, googleAuthRoutes);
app.use('/api/subscription', billingLimiter, subscriptionRoutes);
app.use('/api/billing', billingLimiter, billingRoutes);
app.use('/api/stripe', billingLimiter, stripeRoutes);
app.use('/api/extraction', extractionLimiter, extractionRoutes);
app.use('/api/extraction', textExtractionRoutes); // Text processing routes
app.use('/api/extraction/v2', extractionLimiter, extractionV2Routes); // New architecture routes (testing)
app.use('/api/jobs', jobsRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/dashboard', dashboardAggregatedRoutes); // Aggregated endpoint for performance
app.use('/api/dashboard', dashboardOptimizedRoutes); // Optimized single endpoint (73% smaller payload)
app.use('/api/upgrade', upgradeWorkflowRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/support', supportRoutes); // Support email service
app.use('/api/evaluation', extractionLimiter, evaluationRoutes); // Extraction evaluation routes

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


