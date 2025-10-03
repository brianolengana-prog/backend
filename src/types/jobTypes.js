const Joi = require('joi');

const JobTypes = {
  EXTRACTION: 'extraction',
  CLEANUP: 'cleanup',
  NOTIFICATION: 'notification'
};

const JobSchemas = {
  [JobTypes.EXTRACTION]: Joi.object({
    userId: Joi.string().uuid().required(),
    fileId: Joi.string().uuid().required(),
    fileName: Joi.string().required(),
    fileType: Joi.string().valid('pdf', 'docx', 'xlsx', 'csv', 'image').required(),
    fileSize: Joi.number().positive().required(),
    extractionMethod: Joi.string().valid('hybrid', 'ai', 'pattern', 'aws-textract').default('hybrid'),
    priority: Joi.string().valid('low', 'normal', 'high', 'urgent').default('normal'),
    options: Joi.object({
      rolePreferences: Joi.array().items(Joi.string()),
      customPatterns: Joi.array().items(Joi.string()),
      qualityThreshold: Joi.number().min(0).max(1).default(0.8)
    }).default({}),
    metadata: Joi.object({
      source: Joi.string().default('api'),
      userAgent: Joi.string(),
      ipAddress: Joi.string()
    }).default({})
  }),

  [JobTypes.CLEANUP]: Joi.object({
    fileId: Joi.string().uuid().required(),
    filePath: Joi.string().required(),
    retentionDays: Joi.number().positive().default(7)
  }),

  [JobTypes.NOTIFICATION]: Joi.object({
    userId: Joi.string().uuid().required(),
    type: Joi.string().valid('extraction_complete', 'extraction_failed', 'quota_warning').required(),
    data: Joi.object().required()
  })
};

module.exports = {
  JobTypes,
  JobSchemas
};
