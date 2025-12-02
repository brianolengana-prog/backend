/**
 * Test Database Connection
 * Direct test to see what error we get
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

console.log('🔍 Testing database connection...');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET (' + process.env.DATABASE_URL.length + ' chars)' : 'NOT SET');
console.log('');

const client = new PrismaClient({
  log: ['error', 'warn'],
});

async function test() {
  try {
    console.log('Attempting connection...');
    await client.$connect();
    console.log('✅ Connected successfully!');
    
    // Test query
    console.log('Testing query...');
    await client.$queryRaw`SELECT 1`;
    console.log('✅ Query successful!');
    
    await client.$disconnect();
    console.log('✅ Disconnected');
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed!');
    console.error('Error Code:', error.code || 'N/A');
    console.error('Error Name:', error.name || 'N/A');
    console.error('Error Message:', error.message);
    if (error.meta) {
      console.error('Error Meta:', JSON.stringify(error.meta, null, 2));
    }
    process.exit(1);
  }
}

// Add timeout
const timeout = setTimeout(() => {
  console.error('❌ Connection timeout after 10 seconds');
  process.exit(1);
}, 10000);

test().finally(() => {
  clearTimeout(timeout);
});

