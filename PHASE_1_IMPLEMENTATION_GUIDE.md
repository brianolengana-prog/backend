# Phase 1 Implementation Guide
## Foundation & Infrastructure Setup

**Duration**: 2 weeks  
**Goal**: Establish foundation without breaking existing code

---

## 🎯 Phase 1 Objectives

1. ✅ Create new directory structure
2. ✅ Implement base repository pattern
3. ✅ Create infrastructure services
4. ✅ Set up dependency injection foundation
5. ✅ Zero breaking changes

---

## 📁 Step 1: Create Directory Structure

### 1.1 Create New Directories

```bash
# Run from project root
mkdir -p src/domains/{extraction,contacts,auth,billing,jobs}/{entities,services,repositories}
mkdir -p src/domains/extraction/{strategies,processors,validators,value-objects}
mkdir -p src/shared/infrastructure/{database,queue,cache}
mkdir -p src/shared/{utils,middleware,types,config}
mkdir -p src/api/{routes,controllers,middleware,dto}
mkdir -p src/workers/{extraction,cleanup,billing}
```

### 1.2 Create README Files

Create placeholder README files to document each domain:

```bash
# Create README files
touch src/domains/extraction/README.md
touch src/domains/contacts/README.md
touch src/domains/auth/README.md
touch src/domains/billing/README.md
touch src/shared/infrastructure/README.md
```

**Example README content:**

```markdown
# Extraction Domain

**Status**: Planning  
**Migration Date**: TBD

This domain handles all extraction-related functionality.

## Structure
- `entities/` - Domain entities
- `services/` - Business logic
- `strategies/` - Extraction strategies
- `processors/` - Document processors
- `validators/` - Contact validators
- `repositories/` - Data access

## Migration Notes
- Current services to migrate: `extraction-refactored.service.js`, `robustCallSheetExtractor.service.js`
- Target completion: Week 4
```

---

## 🗄️ Step 2: Base Repository Implementation

### 2.1 Create Base Repository

**File**: `src/shared/infrastructure/database/base.repository.js`

```javascript
const { PrismaClient } = require('@prisma/client');

/**
 * Base Repository
 * Provides common CRUD operations for all repositories
 */
class BaseRepository {
  constructor(modelName, prisma = null) {
    if (!prisma) {
      this.prisma = new PrismaClient();
    } else {
      this.prisma = prisma;
    }
    this.modelName = modelName;
    this.model = this.prisma[modelName];
  }

  /**
   * Find by ID
   */
  async findById(id, include = null) {
    const options = { where: { id } };
    if (include) {
      options.include = include;
    }
    return await this.model.findUnique(options);
  }

  /**
   * Find many with optional filters
   */
  async findMany(where = {}, options = {}) {
    const query = {
      where,
      ...options
    };
    return await this.model.findMany(query);
  }

  /**
   * Find first matching record
   */
  async findFirst(where = {}, options = {}) {
    const query = {
      where,
      ...options
    };
    return await this.model.findFirst(query);
  }

  /**
   * Create new record
   */
  async create(data, include = null) {
    const options = { data };
    if (include) {
      options.include = include;
    }
    return await this.model.create(options);
  }

  /**
   * Update record
   */
  async update(id, data, include = null) {
    const options = {
      where: { id },
      data
    };
    if (include) {
      options.include = include;
    }
    return await this.model.update(options);
  }

  /**
   * Delete record
   */
  async delete(id) {
    return await this.model.delete({ where: { id } });
  }

  /**
   * Count records
   */
  async count(where = {}) {
    return await this.model.count({ where });
  }

  /**
   * Upsert record
   */
  async upsert(where, create, update, include = null) {
    const options = {
      where,
      create,
      update
    };
    if (include) {
      options.include = include;
    }
    return await this.model.upsert(options);
  }

  /**
   * Get Prisma client (for complex queries)
   */
  getPrisma() {
    return this.prisma;
  }

  /**
   * Get model (for direct access if needed)
   */
  getModel() {
    return this.model;
  }
}

module.exports = BaseRepository;
```

### 2.2 Create Database Manager (Singleton)

**File**: `src/shared/infrastructure/database/database.manager.js`

```javascript
const { PrismaClient } = require('@prisma/client');
const db = require('../../../config/database');

/**
 * Database Manager
 * Singleton Prisma client instance
 */
class DatabaseManager {
  constructor() {
    this.prisma = null;
    this.isConnected = false;
  }

  /**
   * Get Prisma client instance
   */
  async getClient() {
    if (!this.prisma) {
      // Use existing database connection if available
      if (db && db.getClient) {
        this.prisma = db.getClient();
      } else {
        this.prisma = new PrismaClient();
      }
    }

    if (!this.isConnected) {
      await this.connect();
    }

    return this.prisma;
  }

  /**
   * Connect to database
   */
  async connect() {
    try {
      if (db && db.connect) {
        await db.connect();
      }
      this.isConnected = true;
    } catch (error) {
      console.error('Database connection error:', error);
      throw error;
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect() {
    try {
      if (this.prisma) {
        await this.prisma.$disconnect();
      }
      if (db && db.disconnect) {
        await db.disconnect();
      }
      this.isConnected = false;
    } catch (error) {
      console.error('Database disconnection error:', error);
    }
  }

  /**
   * Execute transaction
   */
  async transaction(callback) {
    const client = await this.getClient();
    return await client.$transaction(callback);
  }
}

// Export singleton instance
module.exports = new DatabaseManager();
```

### 2.3 Create Transaction Manager

**File**: `src/shared/infrastructure/database/transaction.manager.js`

```javascript
const databaseManager = require('./database.manager');

/**
 * Transaction Manager
 * Handles database transactions
 */
class TransactionManager {
  /**
   * Execute callback within transaction
   */
  async execute(callback) {
    const prisma = await databaseManager.getClient();
    return await prisma.$transaction(async (tx) => {
      return await callback(tx);
    });
  }

  /**
   * Execute with retry logic
   */
  async executeWithRetry(callback, maxRetries = 3) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.execute(callback);
      } catch (error) {
        lastError = error;
        // Only retry on transaction errors
        if (error.code === 'P2034') {
          // Transaction conflict, wait and retry
          await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
          continue;
        }
        throw error;
      }
    }
    
    throw lastError;
  }
}

module.exports = new TransactionManager();
```

---

## 🔧 Step 3: Infrastructure Services

### 3.1 Queue Manager (Enhance Existing)

**File**: `src/shared/infrastructure/queue/queue.manager.js`

```javascript
// Refactor existing src/config/queue.js
// Move to shared/infrastructure/queue/queue.manager.js

const Queue = require('bull');
const Redis = require('ioredis');
const env = require('../../../config/env');

class QueueManager {
  constructor() {
    this.redis = null;
    this.queues = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize queues
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    // Initialize Redis connection
    this.redis = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
      enableReadyCheck: false
    });

    // Add event handlers
    this.redis.on('connect', () => {
      console.log('✅ Redis connected');
    });

    this.redis.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
    });

    // Initialize queues
    this.initializeQueues();
    this.isInitialized = true;
  }

  /**
   * Initialize all queues
   */
  initializeQueues() {
    const queueConfig = {
      redis: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD
      }
    };

    // Extraction queue
    this.queues.set('extraction', new Queue('extraction', {
      ...queueConfig,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    }));

    // Priority queue
    this.queues.set('extraction-priority', new Queue('extraction-priority', {
      ...queueConfig,
      defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 100,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      }
    }));

    // Cleanup queue
    this.queues.set('cleanup', new Queue('cleanup', {
      ...queueConfig,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 2,
        delay: 24 * 60 * 60 * 1000
      }
    }));
  }

  /**
   * Get queue by name
   */
  getQueue(name) {
    if (!this.isInitialized) {
      throw new Error('QueueManager not initialized. Call initialize() first.');
    }
    return this.queues.get(name);
  }

  /**
   * Test Redis connection
   */
  async testConnection() {
    try {
      if (!this.redis) {
        await this.initialize();
      }
      await this.redis.ping();
      return true;
    } catch (error) {
      console.error('❌ Redis ping failed:', error.message);
      return false;
    }
  }

  /**
   * Close all queues
   */
  async close() {
    await Promise.all([...this.queues.values()].map(queue => queue.close()));
    if (this.redis) {
      await this.redis.quit();
    }
    this.isInitialized = false;
  }
}

module.exports = new QueueManager();
```

### 3.2 Logger Service (Enhance Existing)

**File**: `src/shared/infrastructure/logger/logger.service.js`

```javascript
// Refactor existing src/utils/logger.js
// Move to shared/infrastructure/logger/logger.service.js

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

class LoggerService {
  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'callsheets-backend' },
      transports: [
        // Console transport
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        // File transports
        new winston.transports.File({
          filename: path.join(logsDir, 'error.log'),
          level: 'error'
        }),
        new winston.transports.File({
          filename: path.join(logsDir, 'combined.log')
        })
      ]
    });
  }

  /**
   * Log info message
   */
  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  /**
   * Log error message
   */
  error(message, error = null, meta = {}) {
    const errorMeta = error
      ? { ...meta, error: error.message, stack: error.stack }
      : meta;
    this.logger.error(message, errorMeta);
  }

  /**
   * Log warning message
   */
  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  /**
   * Log debug message
   */
  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  /**
   * Get Winston logger instance
   */
  getLogger() {
    return this.logger;
  }
}

module.exports = new LoggerService();
```

---

## 📦 Step 4: Example Domain Repository

### 4.1 Contact Repository Example

**File**: `src/domains/contacts/repositories/ContactRepository.js`

```javascript
const BaseRepository = require('../../../shared/infrastructure/database/base.repository');
const databaseManager = require('../../../shared/infrastructure/database/database.manager');

/**
 * Contact Repository
 * Handles all data access for contacts
 */
class ContactRepository extends BaseRepository {
  constructor() {
    // Initialize with Prisma client from database manager
    super('contact', null);
    this.initializePrisma();
  }

  async initializePrisma() {
    this.prisma = await databaseManager.getClient();
    this.model = this.prisma.contact;
  }

  /**
   * Find contacts by user ID with pagination
   */
  async findByUserId(userId, options = {}) {
    await this.initializePrisma();
    
    const {
      page = 1,
      limit = 25,
      search = '',
      role = '',
      jobId = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      requireContact = true
    } = options;

    const where = {
      userId,
      ...(jobId && { jobId }),
      ...(role && { role: { contains: role, mode: 'insensitive' } }),
      ...(requireContact && {
        OR: [
          { email: { not: null } },
          { phone: { not: null } }
        ]
      })
    };

    // Add search filter
    if (search) {
      where.OR = [
        ...(where.OR || []),
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ];
    }

    const skip = (page - 1) * limit;
    const orderBy = { [sortBy]: sortOrder };

    const [contacts, total] = await Promise.all([
      this.model.findMany({
        where,
        skip,
        take: limit,
        orderBy
      }),
      this.model.count({ where })
    ]);

    return {
      contacts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Find contacts by job ID
   */
  async findByJobId(jobId) {
    await this.initializePrisma();
    return await this.model.findMany({
      where: { jobId },
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * Get contact statistics for user
   */
  async getStats(userId) {
    await this.initializePrisma();
    
    const [
      totalContacts,
      contactsByRole,
      contactsWithEmail,
      contactsWithPhone
    ] = await Promise.all([
      this.model.count({ where: { userId } }),
      this.model.groupBy({
        by: ['role'],
        where: { userId },
        _count: { role: true }
      }),
      this.model.count({
        where: { userId, email: { not: null } }
      }),
      this.model.count({
        where: { userId, phone: { not: null } }
      })
    ]);

    return {
      totalContacts,
      contactsByRole: contactsByRole.map(item => ({
        role: item.role || 'Unknown',
        count: item._count.role
      })),
      contactsWithEmail,
      contactsWithPhone
    };
  }
}

module.exports = ContactRepository;
```

---

## ✅ Step 5: Testing & Validation

### 5.1 Create Test File

**File**: `__tests__/infrastructure/base.repository.test.js`

```javascript
const BaseRepository = require('../../src/shared/infrastructure/database/base.repository');

describe('BaseRepository', () => {
  let repository;

  beforeEach(() => {
    repository = new BaseRepository('user');
  });

  afterEach(async () => {
    await repository.prisma.$disconnect();
  });

  test('should create repository instance', () => {
    expect(repository).toBeDefined();
    expect(repository.modelName).toBe('user');
  });

  test('should have Prisma client', () => {
    expect(repository.prisma).toBeDefined();
  });

  // Add more tests...
});
```

### 5.2 Integration Test

**File**: `__tests__/infrastructure/database.manager.test.js`

```javascript
const databaseManager = require('../../src/shared/infrastructure/database/database.manager');

describe('DatabaseManager', () => {
  test('should get Prisma client', async () => {
    const client = await databaseManager.getClient();
    expect(client).toBeDefined();
  });

  test('should connect to database', async () => {
    await databaseManager.connect();
    expect(databaseManager.isConnected).toBe(true);
  });

  afterAll(async () => {
    await databaseManager.disconnect();
  });
});
```

---

## 📝 Step 6: Update Existing Code (Non-Breaking)

### 6.1 Create Compatibility Layer

**File**: `src/shared/infrastructure/database/compatibility.js`

```javascript
/**
 * Compatibility Layer
 * Allows gradual migration without breaking existing code
 */

const databaseManager = require('./database.manager');

// Export Prisma client for backward compatibility
module.exports = {
  async getClient() {
    return await databaseManager.getClient();
  },
  
  async connect() {
    return await databaseManager.connect();
  },
  
  async disconnect() {
    return await databaseManager.disconnect();
  }
};
```

### 6.2 Update Imports Gradually

**Example**: Update one service at a time

```javascript
// OLD (src/services/contacts.service.js)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// NEW (gradual migration)
const databaseManager = require('../../shared/infrastructure/database/database.manager');
// Use databaseManager.getClient() instead of prisma
```

---

## 📋 Phase 1 Checklist

### Week 1
- [ ] Create all directory structures
- [ ] Create README files for each domain
- [ ] Implement BaseRepository
- [ ] Implement DatabaseManager
- [ ] Implement TransactionManager
- [ ] Write unit tests for base repository
- [ ] Write integration tests for database manager

### Week 2
- [ ] Refactor QueueManager to shared/infrastructure
- [ ] Refactor LoggerService to shared/infrastructure
- [ ] Create example ContactRepository
- [ ] Create compatibility layer
- [ ] Update documentation
- [ ] Run full test suite
- [ ] Code review

---

## 🚀 Next Steps After Phase 1

Once Phase 1 is complete:

1. **Phase 2**: Begin extraction domain migration
2. **Update imports**: Start using new infrastructure
3. **Documentation**: Update architecture docs
4. **Team training**: Share new patterns with team

---

## ⚠️ Important Notes

1. **No Breaking Changes**: All changes are additive
2. **Backward Compatible**: Old code continues to work
3. **Gradual Migration**: Migrate one service at a time
4. **Test Everything**: Ensure tests pass before proceeding
5. **Document Changes**: Update docs as you go

---

*This guide will be updated as we progress through Phase 1.*

