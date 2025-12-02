const app = require('./app');
const db = require('./config/database');
const env = require('./config/env');
const { startSubscriptionRenewalJob } = require('./jobs/subscription-renewal.job');

const PORT = env.PORT || 3001;

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


