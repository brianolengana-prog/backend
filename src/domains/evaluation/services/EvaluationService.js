/**
 * Evaluation Service
 * Business logic for running extraction evaluations
 * 
 * SOLID Principles:
 * - Single Responsibility: Handles evaluation logic
 * - Open/Closed: Extensible for new evaluation metrics
 * - Dependency Inversion: Depends on repository abstractions
 */

const TestCaseRepository = require('../repositories/TestCaseRepository');

class EvaluationService {
  constructor() {
    this.testCaseRepository = new TestCaseRepository();
    // Lazy load framework to avoid initialization errors if OpenAI not configured
    this._framework = null;
  }

  /**
   * Get evaluation framework (lazy initialization)
   */
  getFramework() {
    if (!this._framework) {
      try {
        const ExtractionEvaluationFramework = require('../../../tests/extraction/evaluation-framework');
        this._framework = new ExtractionEvaluationFramework();
      } catch (error) {
        throw new Error('Evaluation framework not available. Ensure OpenAI API key is configured.');
      }
    }
    return this._framework;
  }

  /**
   * Run evaluation on a specific service
   */
  async evaluateService(serviceName, options = {}) {
    const framework = this.getFramework();
    
    // Load test cases
    const testCases = await this.testCaseRepository.findAll();
    
    if (testCases.length === 0) {
      throw new Error('No test cases found. Please add test cases first.');
    }

    // Set test cases in framework
    framework.testCases = testCases.map(tc => ({
      id: tc.id,
      name: tc.name,
      text: tc.text,
      expectedContacts: tc.expectedContacts,
      format: tc.format,
      difficulty: tc.difficulty,
      metadata: tc.metadata
    }));

    // Get service based on name
    const service = this.getService(serviceName);
    
    if (!service) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    // Run evaluation
    const result = await framework.evaluateService(service, serviceName, options);
    
    return result;
  }

  /**
   * Compare multiple services
   */
  async compareServices(serviceNames, options = {}) {
    const framework = this.getFramework();
    
    // Load test cases
    const testCases = await this.testCaseRepository.findAll();
    
    if (testCases.length === 0) {
      throw new Error('No test cases found. Please add test cases first.');
    }

    // Set test cases in framework
    framework.testCases = testCases.map(tc => ({
      id: tc.id,
      name: tc.name,
      text: tc.text,
      expectedContacts: tc.expectedContacts,
      format: tc.format,
      difficulty: tc.difficulty,
      metadata: tc.metadata
    }));

    // Get services
    const services = serviceNames.map(name => ({
      service: this.getService(name),
      name
    })).filter(s => s.service !== null);

    if (services.length === 0) {
      throw new Error('No valid services found');
    }

    // Run comparison
    const comparison = await framework.compareServices(services, options);
    
    return comparison;
  }

  /**
   * Get available services
   */
  getService(serviceName) {
    switch (serviceName.toLowerCase()) {
      case 'unified':
        try {
          const unifiedExtraction = require('../../../services/unifiedExtraction.service');
          return unifiedExtraction;
        } catch (error) {
          throw new Error('Unified extraction service not available. Ensure OpenAI API key is configured.');
        }
      
      case 'robust':
        try {
          const RobustCallSheetExtractor = require('../../../services/robustCallSheetExtractor.service');
          const robustExtractor = new RobustCallSheetExtractor();
          return {
            extractContacts: async (text, options) => {
              const result = await robustExtractor.extractContacts(text, options);
              return {
                contacts: result.contacts || [],
                metadata: result.metadata || {}
              };
            }
          };
        } catch (error) {
          throw new Error('Robust extraction service not available.');
        }
      
      default:
        return null;
    }
  }

  /**
   * Get evaluation statistics
   */
  async getStatistics() {
    const testCases = await this.testCaseRepository.findAll();
    
    const stats = {
      total: testCases.length,
      byFormat: {},
      byDifficulty: {},
      recent: testCases
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map(tc => ({
          id: tc.id,
          name: tc.name,
          format: tc.format,
          difficulty: tc.difficulty
        }))
    };

    // Count by format
    testCases.forEach(tc => {
      stats.byFormat[tc.format] = (stats.byFormat[tc.format] || 0) + 1;
    });

    // Count by difficulty
    testCases.forEach(tc => {
      stats.byDifficulty[tc.difficulty] = (stats.byDifficulty[tc.difficulty] || 0) + 1;
    });

    return stats;
  }
}

module.exports = EvaluationService;

