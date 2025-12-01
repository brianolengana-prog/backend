# Shared Infrastructure

**Status**: Phase 1 - Foundation  
**Migration Date**: 2025-01-XX

This directory contains shared infrastructure components used across all domains.

## Structure

```
shared/infrastructure/
├── database/
│   ├── base.repository.js      # Base repository class
│   ├── database.manager.js     # Prisma client singleton
│   └── transaction.manager.js  # Transaction handling
├── queue/
│   └── queue.manager.js        # Bull queue management
├── logger/
│   └── logger.service.js       # Winston logger service
└── features/
    └── feature-flags.service.js # Feature flag management
```

## Components

### Database

- **BaseRepository**: Common CRUD operations for all repositories
- **DatabaseManager**: Singleton Prisma client instance
- **TransactionManager**: Database transaction handling with retry logic

### Queue

- **QueueManager**: Redis-based job queue management using Bull

### Logger

- **LoggerService**: Centralized logging with Winston

### Features

- **FeatureFlagsService**: Gradual rollout and A/B testing support

## Usage

### Repository Pattern

```javascript
const BaseRepository = require('./shared/infrastructure/database/base.repository');
const databaseManager = require('./shared/infrastructure/database/database.manager');

class MyRepository extends BaseRepository {
  constructor() {
    super('modelName', null);
    this.initializePrisma();
  }
  
  async initializePrisma() {
    this.prisma = await databaseManager.getClient();
    this.model = this.prisma.modelName;
  }
}
```

### Database Manager

```javascript
const databaseManager = require('./shared/infrastructure/database/database.manager');

// Get Prisma client
const prisma = await databaseManager.getClient();

// Execute transaction
await databaseManager.transaction(async (tx) => {
  // Use tx instead of prisma
});
```

### Feature Flags

```javascript
const featureFlags = require('./shared/infrastructure/features/feature-flags.service');

if (featureFlags.isEnabledForUser('USE_NEW_EXTRACTION', userId)) {
  // New architecture
} else {
  // Old architecture
}
```

## Migration Notes

- All infrastructure components are backward compatible
- Old code continues to work during migration
- New code should use these shared components

