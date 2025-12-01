#!/bin/bash

# Backend Database Setup Script
# This script helps you set up a new PostgreSQL database for the backend

set -e

echo "🚀 Backend PostgreSQL Database Setup Script"
echo "==========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env not found. Creating template...${NC}"
    cat > .env << 'EOF'
# Database Connection
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"
DIRECT_URL="postgresql://user:password@host:port/database?sslmode=require"

# Application
NODE_ENV=development
PORT=3001
FRONTEND_URL="http://localhost:3000"

# Security
JWT_SECRET="your-secret-key-minimum-32-characters-long"
JWT_EXPIRY="24h"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Redis (optional)
REDIS_DISABLED="true"
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""

# AI Features (optional)
DISABLE_AI="true"
AI_ENABLED_FOR_XLSX="false"
AI_MAX_CHUNKS="20"
AI_CHUNK_SIZE="4000"
AI_EARLY_EXIT_ON_ZERO_CONTACTS="true"
EOF
    echo -e "${GREEN}✅ Created .env template${NC}"
    echo -e "${YELLOW}📝 Please edit .env with your configuration${NC}"
    echo ""
fi

# Function to check if DATABASE_URL is set
check_database_url() {
    if grep -q 'DATABASE_URL="postgresql://user:password@host:port/database' .env 2>/dev/null; then
        echo -e "${RED}❌ DATABASE_URL appears to be a template. Please update it with your actual connection string.${NC}"
        return 1
    fi
    
    if ! grep -q 'DATABASE_URL=' .env 2>/dev/null; then
        echo -e "${RED}❌ DATABASE_URL not found in .env${NC}"
        return 1
    fi
    
    return 0
}

# Function to test database connection
test_connection() {
    echo -e "${YELLOW}🔍 Testing database connection...${NC}"
    
    # Extract DATABASE_URL from .env
    DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d '=' -f2- | tr -d '"')
    
    if [ -z "$DATABASE_URL" ]; then
        echo -e "${RED}❌ Could not extract DATABASE_URL${NC}"
        return 1
    fi
    
    # Test connection using psql if available
    if command -v psql &> /dev/null; then
        if psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
            echo -e "${GREEN}✅ Database connection successful!${NC}"
            return 0
        else
            echo -e "${RED}❌ Database connection failed${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  psql not found. Skipping connection test.${NC}"
        return 0
    fi
}

# Function to enable extensions
enable_extensions() {
    echo -e "${YELLOW}📦 Enabling PostgreSQL extensions...${NC}"
    
    DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d '=' -f2- | tr -d '"')
    
    if command -v psql &> /dev/null; then
        psql "$DATABASE_URL" << EOF
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOF
        echo -e "${GREEN}✅ Extensions enabled${NC}"
    else
        echo -e "${YELLOW}⚠️  psql not found. Please enable extensions manually:${NC}"
        echo "   CREATE EXTENSION IF NOT EXISTS pg_trgm;"
        echo "   CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
    fi
}

# Function to run Prisma migrations
run_migrations() {
    echo -e "${YELLOW}🔄 Running Prisma migrations...${NC}"
    
    # Check if prisma is installed
    if [ ! -f "node_modules/.bin/prisma" ]; then
        echo -e "${YELLOW}⚠️  Prisma not found. Installing dependencies...${NC}"
        npm install
    fi
    
    # Generate Prisma client
    echo -e "${YELLOW}📦 Generating Prisma client...${NC}"
    npx prisma generate
    
    # Check if migrations exist
    if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations)" ]; then
        echo -e "${YELLOW}📤 Running migrations...${NC}"
        npx prisma migrate deploy
    else
        echo -e "${YELLOW}📤 Pushing schema to database...${NC}"
        npx prisma db push --accept-data-loss
    fi
    
    echo -e "${GREEN}✅ Database schema ready${NC}"
}

# Main execution
main() {
    echo "Step 1: Checking environment variables..."
    if ! check_database_url; then
        echo -e "${RED}❌ Please update .env with your database connection string${NC}"
        exit 1
    fi
    echo ""
    
    echo "Step 2: Testing connection..."
    if ! test_connection; then
        echo -e "${RED}❌ Connection test failed. Please check your DATABASE_URL${NC}"
        exit 1
    fi
    echo ""
    
    read -p "Do you want to enable PostgreSQL extensions? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        enable_extensions
        echo ""
    fi
    
    read -p "Do you want to run Prisma migrations? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        run_migrations
        echo ""
    fi
    
    echo -e "${GREEN}✅ Setup complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Verify your database with: npx prisma studio"
    echo "2. Start your backend server"
    echo "3. Test the API endpoints"
}

# Run main function
main

