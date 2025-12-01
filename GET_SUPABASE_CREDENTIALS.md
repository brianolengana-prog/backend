# How to Get Supabase Database Credentials

## Step-by-Step Guide

### Step 1: Open Your Supabase Project

1. Go to https://supabase.com/dashboard
2. Click on your project (the one you just created)

### Step 2: Get Database Connection Strings

1. **Click on "Settings"** (gear icon in the left sidebar)
2. **Click on "Database"** (under Project Settings)
3. Scroll down to find **"Connection string"** section

### Step 3: Copy Connection Strings

You'll see different connection string options. You need **two** of them:

#### For `DATABASE_URL` (Connection Pooling - Recommended for queries)
- Look for **"Connection pooling"** tab
- Select **"Session mode"** or **"Transaction mode"**
- Copy the connection string that looks like:
  ```
  postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
  ```
- This goes in your `.env` as `DATABASE_URL`

#### For `DIRECT_URL` (Direct Connection - For migrations)
- Look for **"Connection string"** tab (not pooling)
- Select **"URI"** format
- Copy the connection string that looks like:
  ```
  postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
  ```
- This goes in your `.env` as `DIRECT_URL`

### Step 4: Get Your Database Password

If you don't know your database password:

1. In the same **Settings → Database** page
2. Look for **"Database password"** section
3. If you forgot it, click **"Reset database password"**
4. **Save the password** - you'll need it for the connection strings

### Step 5: Replace Placeholders

The connection strings will have placeholders like `[YOUR-PASSWORD]`. Replace it with your actual database password.

**Example:**
```
Before: postgresql://postgres.abc123:[YOUR-PASSWORD]@aws-0-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true
After:  postgresql://postgres.abc123:MySecurePassword123@aws-0-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

## Visual Guide

```
Supabase Dashboard
├── Your Project
│   ├── Settings (⚙️)
│   │   ├── Database
│   │   │   ├── Connection string
│   │   │   │   ├── [Connection pooling] ← DATABASE_URL
│   │   │   │   └── [Connection string] ← DIRECT_URL
│   │   │   └── Database password ← Your password
```

## Quick Checklist

- [ ] Opened Supabase dashboard
- [ ] Selected your project
- [ ] Went to Settings → Database
- [ ] Copied Connection Pooling URL → `DATABASE_URL`
- [ ] Copied Direct Connection URL → `DIRECT_URL`
- [ ] Got your database password
- [ ] Replaced `[YOUR-PASSWORD]` in both connection strings

## Next Steps

After you have the credentials:

1. Update your `.env` file
2. Enable PostgreSQL extensions
3. Test the connection
4. Run migrations

See `DATABASE_FIX_URGENT.md` for the complete setup process.

