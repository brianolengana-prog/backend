/**
 * AI Optimization Test
 * 
 * Tests the smart AI usage service with different scenarios
 */

// Load environment variables from .env file
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const optimizedAIUsageService = require('./src/services/optimizedAIUsage.service');

// Mock pattern results for testing
const createMockPatternResult = (contacts, confidence) => ({
  success: true,
  contacts: contacts || [],
  confidence: confidence || 0.8,
  metadata: {
    extractionMethod: 'pattern-based',
    processingTime: 100,
    textLength: 500
  }
});

// Test scenarios
const testScenarios = [
  {
    name: 'High Confidence Pattern Results',
    text: `CALL SHEET - FASHION SHOOT
    
DIRECTOR: John Smith
Email: john@example.com
Phone: (555) 123-4567

PHOTOGRAPHER: Sarah Johnson
Email: sarah@example.com
Phone: (555) 987-6543

MUA: Lisa Brown
Email: lisa@example.com
Phone: (555) 456-7890`,
    patternResult: createMockPatternResult([
      {
        id: '1',
        name: 'John Smith',
        role: 'Director',
        email: 'john@example.com',
        phone: '(555) 123-4567',
        confidence: 0.9
      },
      {
        id: '2',
        name: 'Sarah Johnson',
        role: 'Photographer',
        email: 'sarah@example.com',
        phone: '(555) 987-6543',
        confidence: 0.9
      }
    ], 0.9),
    expectedStrategy: 'pattern-only',
    shouldUseAI: false
  },
  
  {
    name: 'Low Confidence Pattern Results',
    text: `Some random text with scattered contact information.
john@example.com
(555) 123-4567
Sarah Johnson photographer
lisa.brown@example.com
Contact details are not well structured.`,
    patternResult: createMockPatternResult([
      {
        id: '1',
        name: 'John',
        role: '',
        email: 'john@example.com',
        phone: '',
        confidence: 0.4
      }
    ], 0.4),
    expectedStrategy: 'pattern-only',
    shouldUseAI: false
  },
  
  {
    name: 'Incomplete Contact Data',
    text: `PRODUCTION CREW LIST
    
DIRECTOR: Mike Davis
PHOTOGRAPHER: Sarah Wilson
Email: sarah@example.com
MUA: Lisa Thompson
Phone: (555) 789-0123`,
    patternResult: createMockPatternResult([
      {
        id: '1',
        name: 'Mike Davis',
        role: 'Director',
        email: '',
        phone: '',
        confidence: 0.6
      },
      {
        id: '2',
        name: 'Sarah Wilson',
        role: 'Photographer',
        email: 'sarah@example.com',
        phone: '',
        confidence: 0.6
      }
    ], 0.6),
    expectedStrategy: 'single-optimized',
    shouldUseAI: true
  },
  
  {
    name: 'Complex Document with Relationships',
    text: `FASHION SHOOT - CREW HIERARCHY
    
PRODUCTION TEAM:
Director: John Smith (john@example.com)
  Assistant Director: Mike Johnson (mike@example.com)
  
Photography Team:
  Lead Photographer: Sarah Wilson (sarah@example.com)
  Assistant Photographer: Lisa Brown (lisa@example.com)
  
Styling Team:
  Lead Stylist: Emma Davis (emma@example.com)
  Assistant Stylist: Tom Wilson (tom@example.com)`,
    patternResult: createMockPatternResult([
      {
        id: '1',
        name: 'John Smith',
        role: 'Director',
        email: 'john@example.com',
        phone: '',
        confidence: 0.7
      }
    ], 0.7),
    expectedStrategy: 'pattern-only',
    shouldUseAI: false
  }
];

// Test function
const testAIOptimization = async () => {
  console.log('🧠 Testing AI Optimization Service...\n');
  
  const results = [];
  
  for (const scenario of testScenarios) {
    console.log(`📋 Testing: ${scenario.name}`);
    console.log(`📄 Text length: ${scenario.text.length} characters`);
    console.log(`📊 Pattern contacts: ${scenario.patternResult.contacts.length}`);
    console.log(`🎯 Pattern confidence: ${(scenario.patternResult.confidence * 100).toFixed(1)}%`);
    
    try {
      const startTime = Date.now();
      
      const result = await optimizedAIUsageService.processWithSmartAI(
        scenario.text,
        scenario.patternResult,
        {
          confidenceThreshold: 0.7,
          disableAI: false
        }
      );
      
      const processingTime = Date.now() - startTime;
      
      console.log(`✅ Processing completed in ${processingTime}ms`);
      console.log(`📊 Strategy used: ${result.metadata.strategy}`);
      console.log(`🎯 Final confidence: ${(result.metadata.confidence * 100).toFixed(1)}%`);
      console.log(`👥 Contacts found: ${result.contacts.length}`);
      console.log(`🤖 AI used: ${result.metadata.aiUsed ? 'Yes' : 'No'}`);
      console.log(`📝 Tokens used: ${result.metadata.tokensUsed || 0}`);
      
      // Validate expectations
      const strategyMatch = result.metadata.strategy.includes(scenario.expectedStrategy.split('-')[0]);
      const aiUsageMatch = result.metadata.aiUsed === scenario.shouldUseAI;
      
      console.log(`🎯 Strategy match: ${strategyMatch ? '✅' : '❌'} (expected: ${scenario.expectedStrategy})`);
      console.log(`🤖 AI usage match: ${aiUsageMatch ? '✅' : '❌'} (expected: ${scenario.shouldUseAI})`);
      
      results.push({
        scenario: scenario.name,
        success: strategyMatch && aiUsageMatch,
        processingTime,
        strategy: result.metadata.strategy,
        confidence: result.metadata.confidence,
        contacts: result.contacts.length,
        aiUsed: result.metadata.aiUsed,
        tokensUsed: result.metadata.tokensUsed || 0
      });
      
    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
      results.push({
        scenario: scenario.name,
        success: false,
        error: error.message
      });
    }
    
    console.log('─'.repeat(50) + '\n');
  }
  
  // Summary
  console.log('📊 Test Summary:');
  const successfulTests = results.filter(r => r.success);
  const totalTests = results.length;
  
  console.log(`✅ Successful tests: ${successfulTests.length}/${totalTests}`);
  console.log(`📈 Success rate: ${(successfulTests.length / totalTests * 100).toFixed(1)}%`);
  
  if (successfulTests.length > 0) {
    const avgProcessingTime = successfulTests.reduce((sum, r) => sum + r.processingTime, 0) / successfulTests.length;
    const avgTokensUsed = successfulTests.reduce((sum, r) => sum + r.tokensUsed, 0) / successfulTests.length;
    const aiUsageRate = successfulTests.filter(r => r.aiUsed).length / successfulTests.length;
    
    console.log(`⏱️ Average processing time: ${avgProcessingTime.toFixed(0)}ms`);
    console.log(`📝 Average tokens used: ${avgTokensUsed.toFixed(0)}`);
    console.log(`🤖 AI usage rate: ${(aiUsageRate * 100).toFixed(1)}%`);
  }
  
  // Service statistics
  const stats = optimizedAIUsageService.getStats();
  console.log('\n📈 Service Statistics:');
  console.log(`📊 Total requests: ${stats.totalRequests}`);
  console.log(`🤖 AI requests: ${stats.aiRequests}`);
  console.log(`🎯 Pattern requests: ${stats.patternRequests}`);
  console.log(`📋 Cache hits: ${stats.cacheHits}`);
  console.log(`📝 Total tokens used: ${stats.tokensUsed}`);
  console.log(`💰 Costs saved: $${stats.costsSaved.toFixed(4)}`);
  console.log(`📈 AI request rate: ${(stats.aiRequestRate * 100).toFixed(1)}%`);
  console.log(`📈 Cache hit rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`);
  
  return results;
};

// Run the test
testAIOptimization()
  .then((results) => {
    const successCount = results.filter(r => r.success).length;
    
    if (successCount === results.length) {
      console.log('\n🎉 All AI optimization tests passed!');
      console.log('✅ Smart AI usage is working correctly');
      console.log('🚀 Ready for production deployment');
      process.exit(0);
    } else {
      console.log('\n⚠️ Some tests failed');
      console.log('🔧 Review failed tests and fix issues');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error.message);
    process.exit(1);
  });
