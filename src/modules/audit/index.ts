/**
 * Audit Module
 * Centralized audit logging
 * 
 * @module Audit
 */

// Entities
export { AuditLog, AuditAction, AuditSeverity } from './entities/audit-log.entity';
export type { AuditLogMetadata } from './entities/audit-log.entity';

// Repositories
export { AuditLogRepository } from './repositories/audit-log.repository';
export type { CreateAuditLogDto, AuditLogQuery } from './repositories/audit-log.repository';

// Services
export { AuditLogService } from './services/audit-log.service';

