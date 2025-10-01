const app = require('./app');
const db = require('./config/database');
const env = require('./config/env');

const PORT = env.PORT || 3001;

async function start() {
  try {
    await db.connect();
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


