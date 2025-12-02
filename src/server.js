console.log('📦 Loading modules...');
const app = require('./app');
console.log('✅ app.js loaded');
const db = require('./config/database');
console.log('✅ database.js loaded');
const env = require('./config/env');
console.log('✅ env.js loaded');
const { startSubscriptionRenewalJob } = require('./jobs/subscription-renewal.job');
console.log('✅ subscription-renewal.job loaded');

const PORT = env.PORT || 3001;
console.log('✅ All modules loaded, starting server...');

async function start() {
  try {
    console.log('🔄 Connecting to database...');
    await db.connect();
    
    // Test database connection
    const isConnected = await db.testConnection();
    if (!isConnected) {
      throw new Error('Database connection test failed');
    }
    console.log('✅ Database connection verified');
    
    // Start subscription renewal cron job
    startSubscriptionRenewalJob();
    console.log('✅ Subscription renewal job started');
    
    const server = app.listen(PORT, () => {
      console.log(`✅ Clean backend listening on ${PORT}`);
      console.log(`🌐 API available at http://localhost:${PORT}/api`);
    });

    process.on('SIGTERM', async () => {
      console.log('🛑 Shutting down gracefully...');
      server.close(async () => {
        await db.disconnect();
        process.exit(0);
      });
    });
  } catch (e) {
    console.error('❌ Failed to start server:', e.message);
    if (e.stack) {
      console.error('Stack trace:', e.stack);
    }
    process.exit(1);
  }
}

start();


