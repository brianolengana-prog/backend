const app = require('./app');
const db = require('./config/database');
const env = require('./config/env');
const { startSubscriptionRenewalJob } = require('./jobs/subscription-renewal.job');

const PORT = env.PORT || 3001;

async function start() {
  try {
    console.log('🔄 Connecting to database...');
    await db.connect();
    console.log('✅ Database connected successfully');
    
    // Start subscription renewal cron job
    try {
      startSubscriptionRenewalJob();
      console.log('✅ Subscription renewal job started');
    } catch (jobError) {
      console.warn('⚠️ Failed to start subscription renewal job:', jobError.message);
      console.warn('⚠️ Error details:', jobError.stack);
      // Don't fail startup if job fails
    }
    
    console.log(`🚀 Starting server on port ${PORT}...`);
    const server = app.listen(PORT, () => {
      console.log(`✅ Clean backend listening on ${PORT}`);
      console.log(`🌐 API available at http://localhost:${PORT}/api`);
    });

    // Handle server errors
    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
      }
      process.exit(1);
    });

    process.on('SIGTERM', async () => {
      console.log('🛑 SIGTERM received, shutting down gracefully...');
      server.close(async () => {
        await db.disconnect();
        console.log('✅ Shutdown complete');
        process.exit(0);
      });
    });
  } catch (e) {
    console.error('❌ Failed to start server:', e);
    console.error('❌ Error details:', {
      message: e.message,
      stack: e.stack,
      name: e.name
    });
    process.exit(1);
  }
}

start();


