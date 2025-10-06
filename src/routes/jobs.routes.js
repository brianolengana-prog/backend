const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const prisma = new PrismaClient();
const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

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

    res.json({ success: true, data: jobs });
  } catch (error) {
    console.error('❌ Error fetching jobs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch jobs' });
  }
});

module.exports = router;


