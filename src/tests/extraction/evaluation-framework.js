/**
 * Extraction Evaluation Framework
 * 
 * Comprehensive testing framework for evaluating extraction services
 * Measures accuracy, precision, recall, F1 score, processing time, and cost
 */

const fs = require('fs').promises;
const path = require('path');

class ExtractionEvaluationFramework {
  constructor() {
    this.testCases = [];
    this.results = [];
  }

  /**
   * Load test cases from directory
   */
  async loadTestCases(testDataDir) {
    const testFiles = await fs.readdir(testDataDir);
    
    for (const file of testFiles) {
      if (file.endsWith('.json')) {
        const testCase = await this.loadTestCase(path.join(testDataDir, file));
        this.testCases.push(testCase);
      }
    }
    
    console.log(`✅ Loaded ${this.testCases.length} test cases`);
    return this.testCases;
  }

  /**
   * Load a single test case
   */
  async loadTestCase(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const testCase = JSON.parse(content);
    
    return {
      id: testCase.id || path.basename(filePath, '.json'),
      name: testCase.name,
      text: testCase.text,
      expectedContacts: testCase.expectedContacts || [],
      format: testCase.format || 'unknown',
      difficulty: testCase.difficulty || 'medium',
      metadata: testCase.metadata || {}
    };
  }

  /**
   * Evaluate a single extraction service
   */
  async evaluateService(service, serviceName, options = {}) {
    console.log(`\n🔍 Evaluating service: ${serviceName}`);
    console.log(`📊 Test cases: ${this.testCases.length}`);
    
    const results = {
      serviceName,
      testCases: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
        avgProcessingTime: 0,
        avgCost: 0,
        totalContactsFound: 0,
        totalContactsExpected: 0,
        falsePositives: 0,
        falseNegatives: 0
      }
    };

    for (const testCase of this.testCases) {
      const result = await this.evaluateTestCase(service, testCase, options);
      results.testCases.push(result);
      
      // Update summary
      results.summary.total++;
      if (result.passed) results.summary.passed++;
      else results.summary.failed++;
      
      results.summary.totalContactsFound += result.contactsFound.length;
      results.summary.totalContactsExpected += testCase.expectedContacts.length;
      results.summary.falsePositives += result.falsePositives;
      results.summary.falseNegatives += result.falseNegatives;
      results.summary.avgProcessingTime += result.processingTime;
      results.summary.avgCost += result.estimatedCost || 0;
    }

    // Calculate metrics
    results.summary.avgProcessingTime /= results.testCases.length;
    results.summary.avgCost /= results.testCases.length;
    
    // Calculate precision, recall, F1
    const totalFound = results.summary.totalContactsFound;
    const totalExpected = results.summary.totalContactsExpected;
    const falsePositives = results.summary.falsePositives;
    const falseNegatives = results.summary.falseNegatives;
    
    results.summary.precision = totalFound > 0 
      ? (totalFound - falsePositives) / totalFound 
      : 0;
    results.summary.recall = totalExpected > 0 
      ? (totalExpected - falseNegatives) / totalExpected 
      : 0;
    results.summary.f1Score = results.summary.precision + results.summary.recall > 0
      ? 2 * (results.summary.precision * results.summary.recall) / 
        (results.summary.precision + results.summary.recall)
      : 0;
    results.summary.accuracy = results.summary.passed / results.summary.total;

    console.log(`\n✅ Evaluation complete for ${serviceName}`);
    console.log(`   Accuracy: ${(results.summary.accuracy * 100).toFixed(1)}%`);
    console.log(`   Precision: ${(results.summary.precision * 100).toFixed(1)}%`);
    console.log(`   Recall: ${(results.summary.recall * 100).toFixed(1)}%`);
    console.log(`   F1 Score: ${(results.summary.f1Score * 100).toFixed(1)}%`);
    console.log(`   Avg Processing Time: ${results.summary.avgProcessingTime.toFixed(0)}ms`);
    console.log(`   Avg Cost: $${results.summary.avgCost.toFixed(4)}`);

    this.results.push(results);
    return results;
  }

  /**
   * Evaluate a single test case
   */
  async evaluateTestCase(service, testCase, options = {}) {
    const startTime = Date.now();
    
    try {
      // Extract contacts using service
      let extractionResult;
      
      if (typeof service.extractContacts === 'function') {
        // Service expects text
        extractionResult = await service.extractContacts(testCase.text, {
          extractionId: `eval_${testCase.id}`,
          ...options
        });
      } else {
        throw new Error('Service must have extractContacts method');
      }

      const processingTime = Date.now() - startTime;
      
      // Get contacts from result
      const contactsFound = extractionResult.contacts || 
                           extractionResult.result?.contacts || 
                           [];

      // Compare with expected contacts
      const comparison = this.compareContacts(
        contactsFound,
        testCase.expectedContacts
      );

      // Estimate cost (if available)
      const estimatedCost = this.estimateCost(extractionResult, testCase.text);

      return {
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        format: testCase.format,
        difficulty: testCase.difficulty,
        passed: comparison.matches.length === testCase.expectedContacts.length &&
                 comparison.falsePositives === 0 &&
                 comparison.falseNegatives === 0,
        contactsFound: contactsFound,
        contactsExpected: testCase.expectedContacts,
        matches: comparison.matches,
        falsePositives: comparison.falsePositives,
        falseNegatives: comparison.falseNegatives,
        missingContacts: comparison.missingContacts,
        extraContacts: comparison.extraContacts,
        processingTime,
        estimatedCost,
        metadata: extractionResult.metadata || {}
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        format: testCase.format,
        difficulty: testCase.difficulty,
        passed: false,
        error: error.message,
        contactsFound: [],
        contactsExpected: testCase.expectedContacts,
        matches: [],
        falsePositives: 0,
        falseNegatives: testCase.expectedContacts.length,
        missingContacts: testCase.expectedContacts,
        extraContacts: [],
        processingTime,
        estimatedCost: 0
      };
    }
  }

  /**
   * Compare found contacts with expected contacts
   */
  compareContacts(found, expected) {
    const matches = [];
    const missingContacts = [];
    const extraContacts = [];
    
    // Create lookup maps
    const expectedMap = new Map();
    expected.forEach(contact => {
      const key = this.getContactKey(contact);
      expectedMap.set(key, contact);
    });

    const foundMap = new Map();
    found.forEach(contact => {
      const key = this.getContactKey(contact);
      foundMap.set(key, contact);
    });

    // Find matches
    for (const [key, expectedContact] of expectedMap) {
      if (foundMap.has(key)) {
        matches.push({
          expected: expectedContact,
          found: foundMap.get(key)
        });
      } else {
        missingContacts.push(expectedContact);
      }
    }

    // Find extra contacts (false positives)
    for (const [key, foundContact] of foundMap) {
      if (!expectedMap.has(key)) {
        extraContacts.push(foundContact);
      }
    }

    return {
      matches,
      falsePositives: extraContacts.length,
      falseNegatives: missingContacts.length,
      missingContacts,
      extraContacts
    };
  }

  /**
   * Generate unique key for contact comparison
   */
  getContactKey(contact) {
    // Use email if available (most reliable)
    if (contact.email) {
      return `email:${contact.email.toLowerCase().trim()}`;
    }
    
    // Use phone if available
    if (contact.phone) {
      const phoneDigits = contact.phone.replace(/\D/g, '');
      if (phoneDigits.length >= 10) {
        return `phone:${phoneDigits}`;
      }
    }
    
    // Use name as fallback (less reliable)
    if (contact.name) {
      const nameKey = contact.name.toLowerCase()
        .replace(/[^a-z]/g, '')
        .substring(0, 20);
      return `name:${nameKey}`;
    }
    
    return `unknown:${JSON.stringify(contact)}`;
  }

  /**
   * Estimate cost based on extraction result
   */
  estimateCost(result, text) {
    // If metadata has token usage, calculate cost
    if (result.metadata?.tokensUsed) {
      const tokens = result.metadata.tokensUsed;
      // GPT-4o-mini pricing: $0.00015/1k input, $0.0006/1k output
      // Rough estimate: assume 80% input, 20% output
      const inputTokens = tokens * 0.8;
      const outputTokens = tokens * 0.2;
      const cost = (inputTokens / 1000) * 0.00015 + (outputTokens / 1000) * 0.0006;
      return cost;
    }
    
    // Fallback: estimate from text length
    const estimatedTokens = Math.ceil(text.length / 4);
    const estimatedCost = (estimatedTokens / 1000) * 0.00015; // Input only
    return estimatedCost;
  }

  /**
   * Compare multiple services
   */
  async compareServices(services, options = {}) {
    console.log(`\n📊 Comparing ${services.length} services`);
    
    const comparisons = [];
    
    for (const { service, name } of services) {
      const result = await this.evaluateService(service, name, options);
      comparisons.push(result);
    }

    // Generate comparison report
    const report = this.generateComparisonReport(comparisons);
    
    return {
      comparisons,
      report
    };
  }

  /**
   * Generate comparison report
   */
  generateComparisonReport(comparisons) {
    const report = {
      summary: {
        services: comparisons.length,
        testCases: this.testCases.length
      },
      rankings: {
        accuracy: [],
        precision: [],
        recall: [],
        f1Score: [],
        speed: [],
        cost: []
      },
      detailed: comparisons
    };

    // Rank services by each metric
    report.rankings.accuracy = comparisons
      .map(c => ({ name: c.serviceName, value: c.summary.accuracy }))
      .sort((a, b) => b.value - a.value);
    
    report.rankings.precision = comparisons
      .map(c => ({ name: c.serviceName, value: c.summary.precision }))
      .sort((a, b) => b.value - a.value);
    
    report.rankings.recall = comparisons
      .map(c => ({ name: c.serviceName, value: c.summary.recall }))
      .sort((a, b) => b.value - a.value);
    
    report.rankings.f1Score = comparisons
      .map(c => ({ name: c.serviceName, value: c.summary.f1Score }))
      .sort((a, b) => b.value - a.value);
    
    report.rankings.speed = comparisons
      .map(c => ({ name: c.serviceName, value: c.summary.avgProcessingTime }))
      .sort((a, b) => a.value - b.value);
    
    report.rankings.cost = comparisons
      .map(c => ({ name: c.serviceName, value: c.summary.avgCost }))
      .sort((a, b) => a.value - b.value);

    return report;
  }

  /**
   * Generate detailed report
   */
  async generateReport(outputPath) {
    const report = {
      timestamp: new Date().toISOString(),
      testCases: this.testCases.length,
      results: this.results,
      summary: this.generateSummary()
    };

    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${outputPath}`);
    
    return report;
  }

  /**
   * Generate summary statistics
   */
  generateSummary() {
    if (this.results.length === 0) {
      return { message: 'No results to summarize' };
    }

    const summary = {
      bestAccuracy: {
        service: '',
        value: 0
      },
      bestF1Score: {
        service: '',
        value: 0
      },
      fastest: {
        service: '',
        value: Infinity
      },
      cheapest: {
        service: '',
        value: Infinity
      }
    };

    for (const result of this.results) {
      if (result.summary.accuracy > summary.bestAccuracy.value) {
        summary.bestAccuracy = {
          service: result.serviceName,
          value: result.summary.accuracy
        };
      }

      if (result.summary.f1Score > summary.bestF1Score.value) {
        summary.bestF1Score = {
          service: result.serviceName,
          value: result.summary.f1Score
        };
      }

      if (result.summary.avgProcessingTime < summary.fastest.value) {
        summary.fastest = {
          service: result.serviceName,
          value: result.summary.avgProcessingTime
        };
      }

      if (result.summary.avgCost < summary.cheapest.value) {
        summary.cheapest = {
          service: result.serviceName,
          value: result.summary.avgCost
        };
      }
    }

    return summary;
  }

  /**
   * Print formatted report to console
   */
  printReport() {
    console.log('\n' + '='.repeat(80));
    console.log('EXTRACTION EVALUATION REPORT');
    console.log('='.repeat(80));

    for (const result of this.results) {
      console.log(`\n📊 ${result.serviceName}`);
      console.log(`   Accuracy: ${(result.summary.accuracy * 100).toFixed(1)}%`);
      console.log(`   Precision: ${(result.summary.precision * 100).toFixed(1)}%`);
      console.log(`   Recall: ${(result.summary.recall * 100).toFixed(1)}%`);
      console.log(`   F1 Score: ${(result.summary.f1Score * 100).toFixed(1)}%`);
      console.log(`   Avg Processing Time: ${result.summary.avgProcessingTime.toFixed(0)}ms`);
      console.log(`   Avg Cost: $${result.summary.avgCost.toFixed(4)}`);
      console.log(`   Contacts Found: ${result.summary.totalContactsFound}`);
      console.log(`   Contacts Expected: ${result.summary.totalContactsExpected}`);
      console.log(`   False Positives: ${result.summary.falsePositives}`);
      console.log(`   False Negatives: ${result.summary.falseNegatives}`);
    }

    const summary = this.generateSummary();
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Best Accuracy: ${summary.bestAccuracy.service} (${(summary.bestAccuracy.value * 100).toFixed(1)}%)`);
    console.log(`Best F1 Score: ${summary.bestF1Score.service} (${(summary.bestF1Score.value * 100).toFixed(1)}%)`);
    console.log(`Fastest: ${summary.fastest.service} (${summary.fastest.value.toFixed(0)}ms)`);
    console.log(`Cheapest: ${summary.cheapest.service} ($${summary.cheapest.value.toFixed(4)})`);
    console.log('='.repeat(80));
  }
}

module.exports = ExtractionEvaluationFramework;

