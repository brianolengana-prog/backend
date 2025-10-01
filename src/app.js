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
const billingRoutes = require('./routes/billing.routes');
const extractionRoutes = require('./routes/extraction.routes');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
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
app.use('/api/billing', billingLimiter, billingRoutes);
app.use('/api/extraction', extractionLimiter, extractionRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;


