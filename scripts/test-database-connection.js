#!/usr/bin/env node

/**
 * Database Connection Test Script
 * Tests the database connection and provides diagnostic information
 */

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  console.log('🔍 Testing Database Connection...\n');
  
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set in environment variables');
    console.log('\n💡 Solution: Add DATABASE_URL to your .env file');
    process.exit(1);
  }

  // Mask password in connection string for display
  const maskedUrl = process.env.DATABASE_URL.replace(
    /:([^:@]+)@/,
    ':****@'
  );
  console.log(`📋 Connection String: ${maskedUrl}\n`);

  // Check connection string format
  const urlPattern = /^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/;
  const match = process.env.DATABASE_URL.match(urlPattern);
  
  if (!match) {
    console.error('❌ Invalid DATABASE_URL format');
    console.log('\n💡 Expected format: postgresql://user:password@host:port/database');
    process.exit(1);
  }

  const [, user, password, host, port, database] = match;
  console.log(`   User: ${user}`);
  console.log(`   Host: ${host}`);
  console.log(`   Port: ${port}`);
  console.log(`   Database: ${database}\n`);

  // Test Prisma connection
  console.log('🔄 Testing Prisma connection...');
  const prisma = new PrismaClient({
    log: ['error'],
  });

  try {
    await prisma.$connect();
    console.log('✅ Prisma connection successful!\n');

    // Test a simple query
    console.log('🔄 Testing database query...');
    const result = await prisma.$queryRaw`SELECT version() as version`;
    console.log('✅ Database query successful!');
    console.log(`   PostgreSQL version: ${result[0]?.version || 'Unknown'}\n`);

    // Check if tables exist
    console.log('🔄 Checking database schema...');
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    if (tables.length > 0) {
      console.log(`✅ Found ${tables.length} tables in database:`);
      tables.forEach((table, i) => {
        if (i < 10) {
          console.log(`   - ${table.table_name}`);
        }
      });
      if (tables.length > 10) {
        console.log(`   ... and ${tables.length - 10} more`);
      }
    } else {
      console.log('⚠️  No tables found. You may need to run migrations.');
      console.log('   Run: npx prisma db push');
    }
    console.log('');

    await prisma.$disconnect();
    console.log('✅ All tests passed! Database is ready to use.\n');
    
  } catch (error) {
    console.error('❌ Connection failed!\n');
    console.error('Error details:');
    console.error(`   Message: ${error.message}`);
    
    if (error.message.includes('Tenant or user not found')) {
      console.error('\n💡 This error means:');
      console.error('   - The database project is inactive or deleted');
      console.error('   - The connection string points to a non-existent database');
      console.error('   - You need to set up a new database\n');
      console.error('🔧 Solutions:');
      console.error('   1. Create a new Supabase project');
      console.error('   2. Or use Neon, Railway, or another PostgreSQL provider');
      console.error('   3. Update DATABASE_URL in your .env file');
      console.error('   4. Run: npx prisma db push\n');
      console.error('📚 See: DATABASE_SETUP_GUIDE.md for detailed instructions');
    } else if (error.message.includes('password authentication failed')) {
      console.error('\n💡 Password is incorrect');
      console.error('   - Check your database password');
      console.error('   - Verify the connection string');
    } else if (error.message.includes('does not exist')) {
      console.error('\n💡 Database does not exist');
      console.error('   - Create the database first');
      console.error('   - Or check the database name in the connection string');
    } else if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Cannot reach the database server');
      console.error('   - Check your network connection');
      console.error('   - Verify the host and port are correct');
      console.error('   - Check firewall settings');
    }
    
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }
}

testConnection();

