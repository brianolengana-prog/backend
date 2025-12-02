/**
 * Test Case Repository
 * Data access layer for test cases
 * 
 * SOLID Principles:
 * - Single Responsibility: Only handles data access
 * - Dependency Inversion: Depends on abstractions (file system)
 */

const fs = require('fs').promises;
const path = require('path');
const TestCase = require('../entities/TestCase');

class TestCaseRepository {
  constructor(testDataDir) {
    this.testDataDir = testDataDir || path.join(__dirname, '../../../tests/extraction/test-data');
    this.ensureDirectoryExists();
  }

  /**
   * Ensure test data directory exists
   */
  async ensureDirectoryExists() {
    try {
      await fs.mkdir(this.testDataDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, that's fine
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Get all test cases
   */
  async findAll() {
    try {
      const files = await fs.readdir(this.testDataDir);
      const testCases = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const testCase = await this.findById(path.basename(file, '.json'));
          if (testCase) {
            testCases.push(testCase);
          }
        }
      }
      
      return testCases;
    } catch (error) {
      throw new Error(`Failed to load test cases: ${error.message}`);
    }
  }

  /**
   * Find test case by ID
   */
  async findById(id) {
    try {
      const filePath = path.join(this.testDataDir, `${id}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      return new TestCase({
        ...data,
        id: data.id || id
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw new Error(`Failed to load test case ${id}: ${error.message}`);
    }
  }

  /**
   * Create new test case
   */
  async create(testCaseData) {
    const testCase = new TestCase({
      ...testCaseData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await this.save(testCase);
    return testCase;
  }

  /**
   * Update existing test case
   */
  async update(id, updateData) {
    const testCase = await this.findById(id);
    
    if (!testCase) {
      throw new Error(`Test case ${id} not found`);
    }
    
    testCase.update(updateData);
    await this.save(testCase);
    return testCase;
  }

  /**
   * Delete test case
   */
  async delete(id) {
    try {
      const filePath = path.join(this.testDataDir, `${id}.json`);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw new Error(`Failed to delete test case ${id}: ${error.message}`);
    }
  }

  /**
   * Save test case to file
   */
  async save(testCase) {
    const filePath = path.join(this.testDataDir, `${testCase.id}.json`);
    const content = JSON.stringify(testCase.toJSON(), null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Get test cases by format
   */
  async findByFormat(format) {
    const all = await this.findAll();
    return all.filter(tc => tc.format === format);
  }

  /**
   * Get test cases by difficulty
   */
  async findByDifficulty(difficulty) {
    const all = await this.findAll();
    return all.filter(tc => tc.difficulty === difficulty);
  }

  /**
   * Count test cases
   */
  async count() {
    const all = await this.findAll();
    return all.length;
  }
}

module.exports = TestCaseRepository;

