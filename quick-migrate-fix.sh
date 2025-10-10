#!/bin/bash

# Quick migration fix script
# Run from /home/bkg/parrot/node/backend

echo "🔧 Fixing Prisma migrations..."
echo ""

# Navigate to backend directory
cd "$(dirname "$0")"

echo "📁 Current directory: $(pwd)"
echo ""

# Verify the migration file is fixed
echo "✅ Verifying migration file is corrected..."
if grep -q '"Job"' prisma/migrations/20251008124648_add_file_hash_duplication/migration.sql; then
    echo "❌ ERROR: Migration file still has 'Job' instead of 'jobs'"
    echo "   Please check: prisma/migrations/20251008124648_add_file_hash_duplication/migration.sql"
    exit 1
else
    echo "✅ Migration file uses correct table name 'jobs'"
fi

echo ""
echo "🗑️  Resetting database and applying all migrations..."
echo "   ⚠️  WARNING: This will delete all data in the database!"
echo ""

# Reset and apply migrations
npx prisma migrate reset --force --skip-seed

echo ""
echo "📊 Checking migration status..."
npx prisma migrate status

echo ""
echo "🔄 Generating Prisma client..."
npx prisma generate

echo ""
echo "✅ Migration fix complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Restart your backend server"
echo "  2. Upload Sept 2025 Call Sheet.pdf"
echo "  3. Check logs for: '✅ Contacts saved successfully: contactsSaved=22'"
echo ""




