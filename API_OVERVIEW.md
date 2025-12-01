# Call Sheets Converter Backend API - Detailed Overview

## 🎯 Overview

This is a comprehensive backend API for converting call sheets (production documents) into structured contact data. The system extracts contact information (names, emails, phones, roles) from various document formats (PDF, DOCX, XLSX, CSV, images) using multiple extraction strategies including pattern matching, AI, and OCR.

---

## 📋 Table of Contents

1. [Architecture](#architecture)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Extraction Strategies](#extraction-strategies)
6. [Core Services](#core-services)
7. [Authentication & Security](#authentication--security)
8. [Queue System](#queue-system)
9. [Configuration](#configuration)
10. [Deployment](#deployment)

---

## 🏗️ Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
│              (Web Frontend, Mobile Apps)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTPS/REST API
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Express.js Server                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Middleware Layer                                     │   │
│  │  - Authentication (JWT)                              │   │
│  │  - Rate Limiting                                     │   │
│  │  - Concurrency Limiting                              │   │
│  │  - Error Handling                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Route Handlers                                      │   │
│  │  - /api/extraction                                   │   │
│  │  - /api/contacts                                     │   │
│  │  - /api/auth                                         │   │
│  │  - /api/dashboard                                    │   │
│  │  - /api/billing                                      │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼──────┐ ┌─────▼──────┐ ┌───▼──────────┐
│   Services   │ │  Database   │ │   External   │
│   Layer      │ │  (Prisma)   │ │   Services   │
│              │ │             │ │              │
│ - Extraction │ │ - PostgreSQL │ │ - OpenAI     │
│ - Contacts   │ │ - Supabase  │ │ - AWS        │
│ - Auth       │ │             │ │   Textract   │
│ - Billing    │ │             │ │ - Stripe     │
└──────────────┘ └─────────────┘ └──────────────┘
```

### Service Architecture

The system uses a **modular service architecture** with clear separation of concerns:

1. **Route Layer** (`src/routes/`) - HTTP request handling
2. **Service Layer** (`src/services/`) - Business logic
3. **Repository Layer** (`src/repositories/`) - Data access
4. **Middleware Layer** (`src/middleware/`) - Cross-cutting concerns
5. **Worker Layer** (`src/workers/`) - Background job processing

---

## 🛠️ Technology Stack

### Core Framework
- **Node.js** (v18.18 - v23)
- **Express.js** 4.18.2 - Web framework
- **Prisma** 6.16.2 - ORM and database toolkit

### Database
- **PostgreSQL** (via Supabase)
- **Redis** (optional, for queue management)

### Document Processing
- **pdf-parse** - PDF text extraction
- **mammoth** - DOCX processing
- **xlsx** - Excel file processing
- **sharp** - Image processing
- **tesseract.js** - OCR for images
- **pdfjs-dist** - Advanced PDF parsing

### AI & OCR Services
- **OpenAI API** (GPT-4o Mini) - AI-powered extraction
- **AWS Textract** - Enterprise OCR
- **@aws-sdk/client-textract** - AWS SDK

### Authentication & Security
- **jsonwebtoken** - JWT authentication
- **bcrypt** - Password hashing
- **helmet** - Security headers
- **cors** - Cross-origin resource sharing
- **express-rate-limit** - Rate limiting

### Queue & Background Jobs
- **Bull** - Redis-based job queue
- **ioredis** - Redis client

### Payment Processing
- **Stripe** - Subscription and billing

### Utilities
- **winston** - Logging
- **date-fns** - Date manipulation
- **zod** - Schema validation
- **joi** - Input validation

---

## 🗄️ Database Schema

### Core Models

#### User & Profile
- **User** - Authentication and user management
- **Profile** - Extended user profile information

#### Jobs & Contacts
- **Job** - Extraction job tracking
  - Status: PROCESSING, COMPLETED, FAILED, CANCELLED
  - File metadata (name, URL, hash, size)
  - Links to contacts and production
- **Contact** - Extracted contact information
  - Name, email, phone, role, company
  - Linked to job and user
  - Selection status (isSelected)

#### Productions & Call Sheets
- **Production** - Production/project management
- **CallSheet** - Call sheet documents

#### Usage Tracking
- **Usage** - Monthly usage statistics
  - Jobs processed
  - Contacts extracted
  - API calls

#### Billing
- **Subscription** - Stripe subscription management
- **Payment** - Payment history

#### Security
- **Session** - Active user sessions
- **PasswordResetToken** - Password reset tokens
- **EmailVerificationToken** - Email verification
- **TwoFactorCode** - 2FA codes
- **SecurityAuditLog** - Security event logging

### Key Features
- **File Deduplication** - SHA-256 file hashing prevents duplicate processing
- **Cascade Deletes** - Automatic cleanup of related records
- **Indexes** - Optimized queries on userId, fileHash, status, createdAt
- **UUID Primary Keys** - All IDs use UUID v4

---

## 🌐 API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Google Authentication (`/api/google-auth`)
- `POST /api/google-auth/callback` - OAuth callback
- `GET /api/google-auth/status` - Check auth status

### Extraction (`/api/extraction`)

#### Main Endpoints
- `POST /api/extraction/upload` - **Primary endpoint** - Upload and extract contacts
  - Accepts: PDF, DOCX, XLSX, CSV, images (JPEG, PNG, TIFF)
  - Returns: Extracted contacts with metadata
  - Features:
    - File deduplication (24-hour cache)
    - Usage limit checking
    - Atomic database transactions
    - Performance monitoring
    - Timeout protection (30s)

- `POST /api/extraction/extract` - Extract from text content
- `GET /api/extraction/history` - Get extraction history (paginated)
- `GET /api/extraction/contacts/:jobId` - Get contacts for a job
- `DELETE /api/extraction/job/:jobId` - Delete a job and contacts

#### Alternative Extraction Methods
- `POST /api/extraction/upload-ai` - AI-only extraction
- `POST /api/extraction/upload-aws-textract` - AWS Textract + AI
- `POST /api/extraction/upload-adaptive` - Adaptive intelligence
- `POST /api/extraction/upload-pattern` - Pattern-only extraction

#### Information Endpoints
- `GET /api/extraction/methods` - List available extraction methods
- `GET /api/extraction/health` - Service health status
- `GET /api/extraction/migration-status` - Enterprise migration status

### Contacts (`/api/contacts`)
- `GET /api/contacts` - Get paginated contacts
  - Query params: page, limit, search, role, jobId, sortBy, sortOrder
- `GET /api/contacts/stats` - Get contact statistics
- `GET /api/contacts/:id` - Get specific contact
- `GET /api/contacts/export` - Export contacts
  - Formats: CSV, Excel, JSON, vCard
  - Filters: ids, jobId
- `DELETE /api/contacts/:id` - Delete contact

### Dashboard (`/api/dashboard`)
- `GET /api/dashboard/stats` - User statistics
- `GET /api/dashboard/recent-jobs` - Recent extraction jobs
- `GET /api/dashboard/usage` - Usage metrics

### Billing & Subscriptions (`/api/subscription`, `/api/billing`, `/api/stripe`)
- Subscription management
- Payment processing
- Usage-based billing
- Stripe webhook handling

### Jobs (`/api/jobs`)
- Job status tracking
- Job management

### Usage (`/api/usage`)
- Usage statistics
- Limit checking

### Support (`/api/support`)
- Support email service

---

## 🔍 Extraction Strategies

The system employs multiple extraction strategies, automatically selecting the best approach based on document characteristics.

### 1. Pattern-Based Extraction (Fast, 85-92% accuracy)

**RobustCallSheetExtractor** - Comprehensive pattern matching for call sheets

#### Pattern Categories:
- **Structured Patterns** (High confidence, 0.9-0.98)
  - `ROLE: Name | email | c. phone` (pipe-separated)
  - `ROLE: Name / Phone` (slash-separated)
  - `ROLE: Name / Email / Phone`
  - `ROLE: Name - Phone` (dash-separated)
  - `ROLE: Name (Phone)` (parentheses)

- **Semi-Structured Patterns** (Medium confidence, 0.7-0.9)
  - All-caps ROLE without colon (Sunday Times style)
  - Multi-line patterns
  - Table-like structures

- **Unstructured Patterns** (Lower confidence, 0.5-0.7)
  - Flexible text matching
  - Fallback patterns

#### Features:
- Case-insensitive matching
- Role normalization (Director → DIRECTOR, etc.)
- Phone number normalization
- Email validation
- Confidence scoring

### 2. AI-Based Extraction (Slow, 92-96% accuracy)

**OptimizedAIExtractionService** - GPT-4o Mini powered extraction

#### Features:
- Context-aware processing
- Specialized prompts for call sheets
- Rate limiting (3 requests/minute)
- Token optimization (60k tokens/minute)
- Chunking for large documents
- Early exit on zero contacts

#### Use Cases:
- Complex/unusual formats
- Scanned PDFs (with OCR)
- Poor quality documents
- Non-standard layouts

### 3. AWS Textract Extraction (Medium, 95-98% accuracy)

**AWSTextractService** - Enterprise OCR

#### Features:
- Superior OCR for scanned documents
- Table detection
- Form analysis
- Multi-page processing
- Cost: $1.50 per 1,000 pages (1,000 free/month)

#### Use Cases:
- Scanned PDFs
- Images (JPEG, PNG, TIFF)
- Complex tables
- Forms

### 4. Hybrid Extraction (Balanced, 90-95% accuracy)

**OptimizedHybridExtractionService** - Combines pattern + AI

#### Strategy:
1. Try pattern extraction first (fast)
2. If confidence low, enhance with AI
3. Merge and deduplicate results

### 5. Adaptive Extraction (Intelligent, 90-98% accuracy)

**AdaptiveExtractionService** - Auto-selects best strategy

#### Process:
1. **Document Analysis** - Classify document type and structure
2. **Strategy Selection** - Choose optimal extraction method
3. **Execution** - Run selected strategy
4. **Post-Processing** - Validate and enhance results

#### Document Types Detected:
- Call sheets
- Talent lists
- Crew lists
- Production directories
- Invoices
- Resumes

### 6. Enterprise Extraction (Production-grade, 95-98% accuracy)

**EnterpriseExtractionService** - Advanced extraction for enterprise

#### Features:
- Component-based extraction
- Document classification
- Enhanced adaptive extraction
- Monitoring and metrics
- Queue management
- Migration service (gradual rollout)

---

## 🔧 Core Services

### Extraction Services

#### `extraction-refactored.service.js`
- **Main extraction service** (refactored, modular)
- Delegates to `ExtractionOrchestrator`
- Handles text extraction from documents
- Manages contact persistence

#### `robustCallSheetExtractor.service.js`
- Pattern-based extraction engine
- 100+ regex patterns for call sheets
- Role normalization
- Confidence scoring

#### `optimizedAIExtraction.service.js`
- OpenAI GPT-4o Mini integration
- Rate limiting and cost optimization
- Chunking for large documents
- Specialized prompts

#### `awsTextract.service.js`
- AWS Textract integration
- OCR for scanned documents
- Table and form detection

#### `adaptiveExtraction.service.js`
- Intelligent strategy selection
- Document analysis
- Multi-strategy execution

#### `enterprise/EnterpriseExtractionService.js`
- Enterprise-grade extraction
- Component-based architecture
- Advanced monitoring

### Contact Services

#### `contacts.service.js`
- Contact CRUD operations
- Pagination and filtering
- Search functionality
- Export (CSV, Excel, JSON, vCard)
- Statistics

### Authentication Services

#### `auth.service.js`
- User registration/login
- JWT token management
- Password reset
- Email verification
- 2FA support

### Billing Services

#### `subscription.service.js`
- Subscription management
- Plan upgrades/downgrades
- Usage tracking

#### `stripe.service.js`
- Stripe integration
- Payment processing
- Webhook handling

### Utility Services

#### `usage.service.js`
- Usage tracking
- Limit enforcement
- Monthly statistics

#### `email.service.js`
- Email sending (Nodemailer)
- Support emails
- Notifications

---

## 🔐 Authentication & Security

### Authentication Flow

1. **Registration/Login**
   - User provides email/password or uses Google OAuth
   - Server validates credentials
   - JWT tokens issued (access + refresh)

2. **Token Management**
   - Access tokens: Short-lived (24h default)
   - Refresh tokens: Long-lived
   - Stored in database (Session model)

3. **Request Authentication**
   - `authenticateToken` middleware validates JWT
   - Extracts user ID from token
   - Attaches user to request object

### Security Features

- **Password Hashing** - bcrypt with salt rounds
- **Rate Limiting** - Per-endpoint rate limits
  - Auth endpoints: Stricter limits
  - Extraction endpoints: Higher limits
  - Billing endpoints: Moderate limits
- **Concurrency Limiting** - Prevents server overload
- **CORS** - Configured for specific origins
- **Helmet** - Security headers
- **Input Validation** - Joi/Zod schemas
- **XSS Protection** - xss-clean middleware
- **SQL Injection Protection** - Prisma parameterized queries
- **File Upload Validation** - MIME type checking, size limits (50MB)

### Security Audit
- Login attempt tracking
- Account locking after failed attempts
- Security audit logs
- IP address and user agent tracking

---

## 📦 Queue System

### Architecture

The system uses **Bull** (Redis-based) for background job processing, though currently most extraction is **synchronous** for stability.

### Queues

1. **extraction** - Main extraction queue
2. **extraction-priority** - Priority queue for enterprise customers
3. **cleanup** - File cleanup jobs (24h delay)

### Workers

- **extractionWorker.js** - Processes extraction jobs
- **cleanupWorker.js** - Handles file cleanup
- **workerManager.js** - Manages worker lifecycle

### Queue Features

- Automatic retries (3 attempts, exponential backoff)
- Job prioritization
- Job status tracking
- Cleanup of completed/failed jobs

**Note**: Currently, extraction is primarily synchronous with timeout protection. Queue system is available but not actively used for standard extractions.

---

## ⚙️ Configuration

### Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret (min 32 chars)
- `FRONTEND_URL` - Frontend application URL
- `STRIPE_SECRET_KEY` - Stripe API key
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth secret

Optional:
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production/test)
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` - Redis config
- `OPENAI_API_KEY` - OpenAI API key (for AI extraction)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` - AWS credentials
- `DISABLE_AI` - Disable AI extraction (default: true)
- `ENABLE_WORKERS` - Enable background workers

### Configuration Files

- `src/config/env.js` - Environment validation (Zod)
- `src/config/database.js` - Prisma client setup
- `src/config/queue.js` - Queue configuration
- `src/config/extraction.config.js` - Extraction settings
- `src/config/enterprise.config.js` - Enterprise features

---

## 🚀 Deployment

### Startup Process

1. **Server Initialization** (`src/server.js`)
   - Connect to database
   - Start subscription renewal cron job
   - Start Express server
   - Optionally start workers (production or ENABLE_WORKERS=true)

2. **Application Setup** (`src/app.js`)
   - Configure middleware (CORS, helmet, compression)
   - Register routes
   - Setup error handling
   - Start workers if enabled

### Scripts

- `npm run dev` - Development server
- `npm run start` - Production server
- `npm run workers` - Start workers only
- `npm run dev:full` - Server + workers concurrently
- `npm test` - Run tests

### Health Checks

- `GET /` - Basic status
- `GET /api/health` - Database connectivity check
- `GET /api/extraction/health` - Extraction service health

### Logging

- **Winston** logger configured
- Log files in `logs/` directory:
  - `combined.log` - All logs
  - `error.log` - Errors only
  - `exceptions.log` - Uncaught exceptions
  - `rejections.log` - Unhandled promise rejections
  - `performance.log` - Performance metrics
  - `hybrid-extraction.log` - Extraction logs
  - `job-processor.log` - Job processing logs

---

## 📊 Key Features

### File Processing
- **Multi-format Support**: PDF, DOCX, XLSX, CSV, JPEG, PNG, TIFF
- **File Deduplication**: SHA-256 hashing prevents duplicate processing
- **Caching**: 24-hour cache for identical files
- **Size Limits**: 50MB max file size
- **Memory Storage**: Files processed in memory (no disk I/O)

### Contact Extraction
- **Multiple Strategies**: Pattern, AI, OCR, Hybrid, Adaptive
- **Auto-selection**: Best strategy chosen automatically
- **Validation**: Email/phone validation, deduplication
- **Normalization**: Role normalization, phone formatting
- **Confidence Scoring**: Each contact has confidence score

### Data Management
- **Atomic Transactions**: Database operations are atomic
- **Cascade Deletes**: Automatic cleanup of related records
- **Pagination**: Efficient pagination for large datasets
- **Search**: Full-text search across contacts
- **Export**: Multiple export formats (CSV, Excel, JSON, vCard)

### Performance
- **Concurrency Limiting**: Prevents server overload
- **Rate Limiting**: Prevents abuse
- **Timeout Protection**: 30s timeout for extractions
- **Performance Monitoring**: Tracks extraction performance
- **Optimized Queries**: Database indexes for fast queries

### User Experience
- **Usage Tracking**: Track jobs, contacts, API calls
- **Usage Limits**: Enforce subscription limits
- **Error Handling**: User-friendly error messages
- **Progress Tracking**: (Deprecated - now synchronous)

---

## 🔄 Migration & Evolution

### Current State
- **Primary Extraction**: Synchronous with timeout protection
- **Service Architecture**: Refactored to modular design
- **Enterprise Features**: Gradual migration to enterprise system

### Migration Service
- `ExtractionMigrationService` - Routes requests to appropriate system
- Gradual rollout of enterprise features
- Backward compatibility maintained

### Deprecated Features
- Queue-based async extraction (replaced with sync)
- Job status polling (now immediate response)
- Some legacy extraction services (backed up)

---

## 📝 Notes

- The system is designed for **production use** with robust error handling
- **File deduplication** saves processing time and costs
- **Multiple extraction strategies** ensure high accuracy across document types
- **Enterprise features** are being gradually rolled out
- **Synchronous processing** provides immediate feedback to users
- **Comprehensive logging** aids debugging and monitoring

---

## 🔗 Related Documentation

- `EXTRACTION_STRATEGY.md` - Detailed extraction strategy guide
- `EXTRACTION_WORKFLOW_AND_TESTING_GUIDE.md` - Testing guide
- `ENTERPRISE_IMPLEMENTATION_ROADMAP.md` - Enterprise roadmap
- `QUEUE_SYSTEM.md` - Queue system documentation
- `ERROR_HANDLING_IMPLEMENTATION.md` - Error handling guide

---

*Last Updated: 2025-01-XX*
