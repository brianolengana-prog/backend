#!/bin/bash
# Fix Database Connection - Add SSL and Better Error Handling

cd /home/bkg/parrot/node/backend

echo "🔧 Fixing database connection..."

# Backup current .env
cp .env .env.backup.$(date +%s)

# Read current DATABASE_URL
CURRENT_URL=$(grep "^DATABASE_URL=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$CURRENT_URL" ]; then
  echo "❌ DATABASE_URL not found in .env"
  exit 1
fi

echo "Current DATABASE_URL: ${CURRENT_URL:0:50}..."

# Check if sslmode is already present
if echo "$CURRENT_URL" | grep -q "sslmode"; then
  echo "✅ SSL mode already configured"
else
  echo "Adding sslmode=require to connection string..."
  
  # Add sslmode parameter
  if echo "$CURRENT_URL" | grep -q "?"; then
    # Already has query parameters
    NEW_URL="${CURRENT_URL}&sslmode=require"
  else
    # No query parameters yet
    NEW_URL="${CURRENT_URL}?sslmode=require"
  fi
  
  # Update .env file
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"${NEW_URL}\"|" .env
  echo "✅ Updated DATABASE_URL with SSL mode"
fi

# Check DIRECT_URL
CURRENT_DIRECT=$(grep "^DIRECT_URL=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")

if [ ! -z "$CURRENT_DIRECT" ]; then
  if echo "$CURRENT_DIRECT" | grep -q "sslmode"; then
    echo "✅ DIRECT_URL SSL mode already configured"
  else
    echo "Adding sslmode=require to DIRECT_URL..."
    
    if echo "$CURRENT_DIRECT" | grep -q "?"; then
      NEW_DIRECT="${CURRENT_DIRECT}&sslmode=require"
    else
      NEW_DIRECT="${CURRENT_DIRECT}?sslmode=require"
    fi
    
    sed -i "s|^DIRECT_URL=.*|DIRECT_URL=\"${NEW_DIRECT}\"|" .env
    echo "✅ Updated DIRECT_URL with SSL mode"
  fi
fi

echo ""
echo "✅ Database connection string updated!"
echo ""
echo "📋 Next steps:"
echo "1. Test connection: node -e \"require('./src/config/database').connect(5000).then(() => console.log('OK')).catch(e => console.error(e.message))\""
echo "2. Start server: npm start"
echo ""

