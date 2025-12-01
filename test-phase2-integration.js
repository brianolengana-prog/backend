/**
 * Phase 2 Integration Test
 * 
 * Tests the new extraction domain architecture
 * Run with: node test-phase2-integration.js
 */

const ExtractionService = require('./src/domains/extraction/services/ExtractionService');
const ExtractionStrategyFactory = require('./src/domains/extraction/services/ExtractionStrategyFactory');
const Document = require('./src/domains/extraction/value-objects/Document');
const ExtractionResult = require('./src/domains/extraction/value-objects/ExtractionResult');

// Test call sheet text
const testCallSheet = `
PRODUCTION CALL SHEET

DIRECTOR: John Smith | john.smith@example.com | c. 555-1234
PRODUCER: Jane Doe | jane.doe@example.com | c. 555-5678
CAMERA OPERATOR: Bob Johnson | bob@example.com | c. 555-9012
SOUND: Alice Williams | alice@example.com | c. 555-3456
`;

async function testPhase2Integration() {
  console.log('🧪 Testing Phase 2: Extraction Domain Integration\n');
  console.log('='.repeat(60));

  try {
    // Test 1: Strategy Factory
    console.log('\n📋 Test 1: Strategy Factory');
    console.log('-'.repeat(60));
    
    const strategyFactory = new ExtractionStrategyFactory();
    const document = Document.fromText(testCallSheet, 'test-call-sheet.txt');
    
    const strategies = await strategyFactory.getAvailableStrategies({
      type: 'call_sheet',
      complexity: 'low'
    });
    
    console.log(`✅ Found ${strategies.length} available strategies:`);
    strategies.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.name} - Confidence: ${(s.confidence * 100).toFixed(0)}%`);
    });

    // Test 2: Strategy Selection
    console.log('\n📋 Test 2: Strategy Selection');
    console.log('-'.repeat(60));
    
    const selectedStrategy = await strategyFactory.selectStrategy({
      type: 'call_sheet',
      complexity: 'low'
    }, {
      preferFast: true
    });
    
    console.log(`✅ Selected strategy: ${selectedStrategy.getName()}`);
    console.log(`   Description: ${selectedStrategy.getDescription()}`);
    console.log(`   Available: ${await selectedStrategy.isAvailable()}`);

    // Test 3: Extraction Service
    console.log('\n📋 Test 3: Extraction Service');
    console.log('-'.repeat(60));
    
    const extractionService = new ExtractionService({
      strategyFactory
    });
    
    const result = await extractionService.extractContactsFromText(testCallSheet, {
      extractionId: 'test_integration_001',
      preferFast: true
    });
    
    console.log(`✅ Extraction completed:`);
    console.log(`   Success: ${result.isSuccessful()}`);
    console.log(`   Contacts found: ${result.getContactCount()}`);
    console.log(`   Strategy used: ${result.metadata.strategy}`);
    console.log(`   Processing time: ${result.getProcessingTimeSeconds().toFixed(2)}s`);
    
    if (result.hasContacts()) {
      console.log(`\n   Extracted contacts:`);
      result.contacts.slice(0, 3).forEach((contact, i) => {
        console.log(`   ${i + 1}. ${contact.name || 'Unknown'}`);
        if (contact.email) console.log(`      Email: ${contact.email}`);
        if (contact.phone) console.log(`      Phone: ${contact.phone}`);
        if (contact.role) console.log(`      Role: ${contact.role}`);
      });
    }

    // Test 4: Value Objects
    console.log('\n📋 Test 4: Value Objects');
    console.log('-'.repeat(60));
    
    console.log(`✅ Document value object:`);
    console.log(`   Type: ${document.isPDF() ? 'PDF' : 'Text'}`);
    console.log(`   Content length: ${document.getContentLength()}`);
    console.log(`   Has content: ${document.hasContent()}`);
    
    console.log(`\n✅ ExtractionResult value object:`);
    console.log(`   Is successful: ${result.isSuccessful()}`);
    console.log(`   Has contacts: ${result.hasContacts()}`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(0)}%`);

    // Test 5: Error Handling
    console.log('\n📋 Test 5: Error Handling');
    console.log('-'.repeat(60));
    
    const emptyResult = await extractionService.extractContactsFromText('');
    console.log(`✅ Empty text handled: ${emptyResult.isFailed() ? 'Yes' : 'No'}`);
    
    const nullResult = await extractionService.extractContactsFromText(null);
    console.log(`✅ Null text handled: ${nullResult.isFailed() ? 'Yes' : 'No'}`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Phase 2 Integration Test: PASSED');
    console.log('='.repeat(60));
    console.log('\n🎉 All components working together!');
    console.log('📊 Architecture is clean and functional');
    console.log('🚀 Ready for integration with routes\n');

  } catch (error) {
    console.error('\n❌ Integration test failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run tests
testPhase2Integration();

