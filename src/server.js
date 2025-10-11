const app = require('./app');
const db = require('./config/database');
const env = require('./config/env');
const { startSubscriptionRenewalJob } = require('./jobs/subscription-renewal.job');

const PORT = env.PORT || 3001;

async function start() {
  try {
    await db.connect();
    
    // Start subscription renewal cron job
    startSubscriptionRenewalJob();
    console.log('✅ Subscription renewal job started');
    
    const server = app.listen(PORT, () => {
      console.log(`Clean backend listening on ${PORT}`);
    });

    process.on('SIGTERM', async () => {
      server.close(async () => {
        await db.disconnect();
        process.exit(0);
      });
    });
  } catch (e) {
    console.error('Failed to start:', e);
    process.exit(1);
  }
}

start();


