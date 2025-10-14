const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const prisma = new PrismaClient();
const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * Normalize job data from database (snake_case) to API format (camelCase)
 */
function normalizeJob(job) {
  return {
    id: job.id,
    title: job.title,
    file_name: job.fileName || job.file_name,  // ✅ Support both formats
    fileName: job.fileName || job.file_name,   // ✅ Normalize to camelCase
    status: job.status,
    createdAt: job.createdAt || job.created_at,
    created_at: job.createdAt || job.created_at  // ✅ Backward compatibility
  };
}

/**
 * GET /api/jobs
 * Return jobs for the authenticated user
 */
router.get('/', async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        fileName: true,
        status: true,
        createdAt: true
      }
    });

    // ✅ Normalize all jobs to use camelCase field names
    const normalizedJobs = jobs.map(job => normalizeJob(job));

    console.log(`✅ Returning ${normalizedJobs.length} jobs (normalized to camelCase)`);
    res.json({ success: true, data: normalizedJobs });
  } catch (error) {
    console.error('❌ Error fetching jobs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch jobs' });
  }
});

module.exports = router;


