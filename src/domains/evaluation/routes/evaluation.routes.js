/**
 * Evaluation Routes
 * API routes for extraction evaluation
 * 
 * Security:
 * - All routes require authentication
 * - Input validation and sanitization
 * - Rate limiting applied
 */

const express = require('express');
const { authenticateToken } = require('../../../middleware/auth');
const { body, param, query, validationResult } = require('express-validator');
const EvaluationService = require('../services/EvaluationService');
const TestCaseRepository = require('../repositories/TestCaseRepository');

const router = express.Router();
const evaluationService = new EvaluationService();
const testCaseRepository = new TestCaseRepository();

// All routes require authentication
router.use(authenticateToken);

/**
 * Validation middleware
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

/**
 * GET /api/evaluation/test-cases
 * Get all test cases
 */
router.get(
  '/test-cases',
  [
    query('format').optional().isIn(['structured', 'semi-structured', 'unstructured', 'tabular', 'unknown']),
    query('difficulty').optional().isIn(['easy', 'medium', 'hard'])
  ],
  validate,
  async (req, res) => {
    try {
      const { format, difficulty } = req.query;
      
      let testCases;
      if (format) {
        testCases = await testCaseRepository.findByFormat(format);
      } else if (difficulty) {
        testCases = await testCaseRepository.findByDifficulty(difficulty);
      } else {
        testCases = await testCaseRepository.findAll();
      }
      
      res.json({
        success: true,
        data: testCases.map(tc => tc.toJSON()),
        count: testCases.length
      });
    } catch (error) {
      console.error('Error getting test cases:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get test cases'
      });
    }
  }
);

/**
 * GET /api/evaluation/test-cases/:id
 * Get test case by ID
 */
router.get(
  '/test-cases/:id',
  [param('id').notEmpty().trim()],
  validate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const testCase = await testCaseRepository.findById(id);
      
      if (!testCase) {
        return res.status(404).json({
          success: false,
          error: 'Test case not found'
        });
      }
      
      res.json({
        success: true,
        data: testCase.toJSON()
      });
    } catch (error) {
      console.error('Error getting test case:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get test case'
      });
    }
  }
);

/**
 * POST /api/evaluation/test-cases
 * Create new test case
 */
router.post(
  '/test-cases',
  [
    body('id').notEmpty().trim().isLength({ min: 1, max: 100 }),
    body('name').notEmpty().trim().isLength({ min: 1, max: 200 }),
    body('text').notEmpty().trim().isLength({ min: 10 }),
    body('expectedContacts').isArray().notEmpty(),
    body('expectedContacts.*.name').notEmpty().trim(),
    body('format').optional().isIn(['structured', 'semi-structured', 'unstructured', 'tabular', 'unknown']),
    body('difficulty').optional().isIn(['easy', 'medium', 'hard']),
    body('metadata').optional().isObject()
  ],
  validate,
  async (req, res) => {
    try {
      const testCaseData = {
        ...req.body,
        createdBy: req.user.id
      };
      
      // Check if test case already exists
      const existing = await testCaseRepository.findById(testCaseData.id);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'Test case with this ID already exists'
        });
      }
      
      const testCase = await testCaseRepository.create(testCaseData);
      
      res.status(201).json({
        success: true,
        data: testCase.toJSON()
      });
    } catch (error) {
      console.error('Error creating test case:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create test case'
      });
    }
  }
);

/**
 * PUT /api/evaluation/test-cases/:id
 * Update test case
 */
router.put(
  '/test-cases/:id',
  [
    param('id').notEmpty().trim(),
    body('name').optional().trim().isLength({ min: 1, max: 200 }),
    body('text').optional().trim().isLength({ min: 10 }),
    body('expectedContacts').optional().isArray().notEmpty(),
    body('format').optional().isIn(['structured', 'semi-structured', 'unstructured', 'tabular', 'unknown']),
    body('difficulty').optional().isIn(['easy', 'medium', 'hard']),
    body('metadata').optional().isObject()
  ],
  validate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const testCase = await testCaseRepository.update(id, updateData);
      
      res.json({
        success: true,
        data: testCase.toJSON()
      });
    } catch (error) {
      console.error('Error updating test case:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update test case'
      });
    }
  }
);

/**
 * DELETE /api/evaluation/test-cases/:id
 * Delete test case
 */
router.delete(
  '/test-cases/:id',
  [param('id').notEmpty().trim()],
  validate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await testCaseRepository.delete(id);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Test case not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Test case deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting test case:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete test case'
      });
    }
  }
);

/**
 * POST /api/evaluation/run
 * Run evaluation on a service
 */
router.post(
  '/run',
  [
    body('serviceName').notEmpty().isIn(['unified', 'robust']),
    body('options').optional().isObject()
  ],
  validate,
  async (req, res) => {
    try {
      const { serviceName, options = {} } = req.body;
      
      const result = await evaluationService.evaluateService(serviceName, options);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error running evaluation:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to run evaluation'
      });
    }
  }
);

/**
 * POST /api/evaluation/compare
 * Compare multiple services
 */
router.post(
  '/compare',
  [
    body('serviceNames').isArray().notEmpty(),
    body('serviceNames.*').isIn(['unified', 'robust']),
    body('options').optional().isObject()
  ],
  validate,
  async (req, res) => {
    try {
      const { serviceNames, options = {} } = req.body;
      
      const comparison = await evaluationService.compareServices(serviceNames, options);
      
      res.json({
        success: true,
        data: comparison
      });
    } catch (error) {
      console.error('Error comparing services:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to compare services'
      });
    }
  }
);

/**
 * GET /api/evaluation/statistics
 * Get evaluation statistics
 */
router.get(
  '/statistics',
  async (req, res) => {
    try {
      const stats = await evaluationService.getStatistics();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get statistics'
      });
    }
  }
);

module.exports = router;

