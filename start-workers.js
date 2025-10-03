#!/usr/bin/env node

/**
 * Development Worker Starter
 * Run this script to start workers in development mode
 */

const workerManager = require('./src/workers/workerManager');

async function startWorkers() {
  try {
    console.log('🚀 Starting workers in development mode...');
    await workerManager.start();
    console.log('✅ Workers started successfully');
    
    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down workers...');
      await workerManager.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down workers...');
      await workerManager.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start workers:', error);
    process.exit(1);
  }
}

startWorkers();
