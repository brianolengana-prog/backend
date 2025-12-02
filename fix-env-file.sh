#!/bin/bash
# Fix corrupted .env file

cd /home/bkg/parrot/node/backend

echo "🔧 Fixing corrupted .env file..."

# Backup
cp .env .env.corrupted.backup

# Get the original connection strings (from deployed version format)
# Since production works, we'll use that format

# Remove all DATABASE_URL lines
sed -i '/^DATABASE_URL/d' .env

# Add correct DATABASE_URL (using production format - what works in deployed)
echo 'DATABASE_URL="postgresql://postgres.ypnwgyrdovjyxkgszwbd:V3T1M1TmquFqeXsz@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require"' >> .env

# Fix DIRECT_URL if needed
if grep -q "^DIRECT_URL" .env; then
  sed -i 's|^DIRECT_URL=.*|DIRECT_URL="postgresql://postgres.ypnwgyrdovjyxkgszwbd:V3T1M1TmquFqeXsz@aws-1-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require"|' .env
else
  echo 'DIRECT_URL="postgresql://postgres.ypnwgyrdovjyxkgszwbd:V3T1M1TmquFqeXsz@aws-1-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require"' >> .env
fi

echo "✅ .env file fixed!"
echo ""
echo "Verifying..."
grep "^DATABASE_URL" .env
echo ""
echo "Test with: node -e \"require('dotenv').config(); console.log('URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');\""

