#!/usr/bin/env node

/**
 * Run Extraction Evaluation
 * 
 * Usage:
 *   node run-evaluation.js [options]
 * 
 * Options:
 *   --test-data-dir <path>  Path to test data directory (default: ./test-data)
 *   --output <path>          Output report path (default: ./evaluation-report.json)
 *   --service <name>         Evaluate specific service (unified|robust|hybrid)
 *   --compare                Compare all services
 */

const path = require('path');
const ExtractionEvaluationFramework = require('./evaluation-framework');

// Import extraction services
const unifiedExtraction = require('../../../src/services/unifiedExtraction.service');
const RobustCallSheetExtractor = require('../../../src/services/robustCallSheetExtractor.service');
// Add other services as needed

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let testDataDir = path.join(__dirname, 'test-data');
  let outputPath = path.join(__dirname, 'evaluation-report.json');
  let serviceName = null;
  let compare = false;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--test-data-dir' && args[i + 1]) {
      testDataDir = args[++i];
    } else if (args[i] === '--output' && args[i + 1]) {
      outputPath = args[++i];
    } else if (args[i] === '--service' && args[i + 1]) {
      serviceName = args[++i];
    } else if (args[i] === '--compare') {
      compare = true;
    }
  }

  console.log('🚀 Starting Extraction Evaluation');
  console.log(`📁 Test Data Directory: ${testDataDir}`);
  console.log(`📄 Output Path: ${outputPath}`);

  // Initialize framework
  const framework = new ExtractionEvaluationFramework();

  // Load test cases
  try {
    await framework.loadTestCases(testDataDir);
  } catch (error) {
    console.error(`❌ Failed to load test cases: ${error.message}`);
    process.exit(1);
  }

  if (framework.testCases.length === 0) {
    console.error('❌ No test cases found');
    process.exit(1);
  }

  // Define services to evaluate
  const services = [];

  if (serviceName) {
    // Evaluate specific service
    switch (serviceName.toLowerCase()) {
      case 'unified':
        services.push({
          service: unifiedExtraction,
          name: 'UnifiedExtractionService'
        });
        break;
      case 'robust':
        const robustExtractor = new RobustCallSheetExtractor();
        services.push({
          service: {
            extractContacts: async (text, options) => {
              const result = await robustExtractor.extractContacts(text, options);
              return {
                contacts: result.contacts || [],
                metadata: result.metadata || {}
              };
            }
          },
          name: 'RobustCallSheetExtractor'
        });
        break;
      default:
        console.error(`❌ Unknown service: ${serviceName}`);
        console.log('Available services: unified, robust');
        process.exit(1);
    }
  } else if (compare) {
    // Compare all services
    services.push(
      {
        service: unifiedExtraction,
        name: 'UnifiedExtractionService'
      },
      {
        service: {
          extractContacts: async (text, options) => {
            const robustExtractor = new RobustCallSheetExtractor();
            const result = await robustExtractor.extractContacts(text, options);
            return {
              contacts: result.contacts || [],
              metadata: result.metadata || {}
            };
          }
        },
        name: 'RobustCallSheetExtractor'
      }
    );
  } else {
    // Default: evaluate unified service
    services.push({
      service: unifiedExtraction,
      name: 'UnifiedExtractionService'
    });
  }

  // Run evaluation
  try {
    if (services.length === 1) {
      await framework.evaluateService(services[0].service, services[0].name);
    } else {
      await framework.compareServices(services);
    }

    // Generate report
    await framework.generateReport(outputPath);
    framework.printReport();

    console.log('\n✅ Evaluation complete!');

  } catch (error) {
    console.error(`❌ Evaluation failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main };

