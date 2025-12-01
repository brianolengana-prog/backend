#!/bin/bash

# Script to update DATABASE_URL and DIRECT_URL in .env file
# Run this after you get your Supabase connection strings

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🔧 Supabase Database Credentials Updater"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo "Creating .env file from template..."
    touch .env
fi

echo "📋 Instructions:"
echo "1. Go to: https://supabase.com/dashboard"
echo "2. Select your project"
echo "3. Go to: Settings → Database"
echo "4. Copy the connection strings"
echo ""

# Get DATABASE_URL (Connection Pooling)
echo -e "${YELLOW}Enter your DATABASE_URL (Connection Pooling):${NC}"
echo "   (From: Settings → Database → Connection pooling → Session mode)"
read -p "DATABASE_URL: " DATABASE_URL

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL cannot be empty${NC}"
    exit 1
fi

# Get DIRECT_URL (Direct Connection)
echo ""
echo -e "${YELLOW}Enter your DIRECT_URL (Direct Connection):${NC}"
echo "   (From: Settings → Database → Connection string → URI)"
read -p "DIRECT_URL: " DIRECT_URL

if [ -z "$DIRECT_URL" ]; then
    echo -e "${RED}❌ DIRECT_URL cannot be empty${NC}"
    exit 1
fi

# Backup .env
if [ -f ".env" ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}✅ Backed up .env file${NC}"
fi

# Update or add DATABASE_URL
if grep -q "^DATABASE_URL=" .env; then
    # Replace existing
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"$DATABASE_URL\"|" .env
    echo -e "${GREEN}✅ Updated DATABASE_URL${NC}"
else
    # Add new
    echo "DATABASE_URL=\"$DATABASE_URL\"" >> .env
    echo -e "${GREEN}✅ Added DATABASE_URL${NC}"
fi

# Update or add DIRECT_URL
if grep -q "^DIRECT_URL=" .env; then
    # Replace existing
    sed -i "s|^DIRECT_URL=.*|DIRECT_URL=\"$DIRECT_URL\"|" .env
    echo -e "${GREEN}✅ Updated DIRECT_URL${NC}"
else
    # Add new
    echo "DIRECT_URL=\"$DIRECT_URL\"" >> .env
    echo -e "${GREEN}✅ Added DIRECT_URL${NC}"
fi

echo ""
echo -e "${GREEN}✅ .env file updated successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Enable PostgreSQL extensions in Supabase SQL Editor:"
echo "   CREATE EXTENSION IF NOT EXISTS pg_trgm;"
echo "   CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
echo ""
echo "2. Test the connection:"
echo "   node scripts/test-database-connection.js"
echo ""
echo "3. Run migrations:"
echo "   npx prisma generate"
echo "   npx prisma db push"

