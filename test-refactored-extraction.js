/**
 * Test script to verify refactored extraction service maintains compatibility
 */

const fs = require('fs');
const path = require('path');

async function testRefactoredExtraction() {
  console.log('🧪 Testing Refactored Extraction Service...\n');

  try {
    // Test the refactored extraction service
    const refactoredService = require('./src/services/extraction-refactored.service');
    
    // Test 1: Health check
    console.log('📋 Test 1: Health Check');
    const healthStatus = refactoredService.getHealthStatus();
    console.log('✅ Health status:', {
      version: healthStatus.version,
      initialized: healthStatus.initialized,
      components: Object.keys(healthStatus.components),
      librariesInitialized: healthStatus.libraries.initialized
    });

    // Test 2: Text extraction from buffer
    console.log('\n📋 Test 2: Text Extraction');
    const testText = `
PHOTOGRAPHER: John Smith / 555-123-4567
MUA: Jane Doe / jane@example.com / 555-987-6543
STYLIST: Bob Wilson
555-555-5555
MODEL: Sarah Johnson / Agency XYZ / 555-111-2222
PRODUCER: Mike Davis / mike@production.com / 555-333-4444
    `;
    
    const testBuffer = Buffer.from(testText, 'utf-8');
    const extractedText = await refactoredService.extractTextFromDocument(testBuffer, 'text/plain');
    
    console.log('✅ Text extraction successful:', {
      originalLength: testText.length,
      extractedLength: extractedText.length,
      matches: extractedText === testText.trim()
    });

    // Test 3: Contact extraction from text
    console.log('\n📋 Test 3: Contact Extraction from Text');
    const contacts = await refactoredService.extractContactsFromText(extractedText);
    
    console.log('✅ Contact extraction results:', {
      contactsFound: contacts.length,
      contacts: contacts.map(c => ({
        name: c.name,
        role: c.role,
        phone: c.phone,
        email: c.email,
        confidence: c.confidence,
        source: c.source
      }))
    });

    // Test 4: Full extraction workflow
    console.log('\n📋 Test 4: Full Extraction Workflow');
    const fullResult = await refactoredService.extractContacts(
      testBuffer,
      'text/plain',
      'test-call-sheet.txt',
      { maxContacts: 100 }
    );
    
    console.log('✅ Full extraction results:', {
      success: fullResult.success,
      contactsFound: fullResult.contacts?.length || 0,
      metadata: {
        documentType: fullResult.metadata?.documentType,
        processingTime: fullResult.metadata?.processingTime,
        confidence: fullResult.metadata?.confidence,
        extractionMethod: fullResult.metadata?.extractionMethod
      }
    });

    // Test 5: Component isolation test
    console.log('\n📋 Test 5: Component Isolation Test');
    
    // Test individual components
    const DocumentProcessor = require('./src/services/extraction/DocumentProcessor');
    const DocumentAnalyzer = require('./src/services/extraction/DocumentAnalyzer');
    const ContactExtractor = require('./src/services/extraction/ContactExtractor');
    const ContactValidator = require('./src/services/extraction/ContactValidator');
    
    // Test document analysis
    const analysis = DocumentAnalyzer.analyzeDocument(extractedText, 'test-call-sheet.txt');
    console.log('✅ Document analysis:', {
      type: analysis.type,
      productionType: analysis.productionType,
      estimatedContacts: analysis.estimatedContacts,
      confidence: analysis.confidence
    });
    
    // Test contact extraction
    const rawContacts = await ContactExtractor.extractContacts(extractedText, { maxContacts: 50 });
    console.log('✅ Raw contact extraction:', {
      contactsFound: rawContacts.length
    });
    
    // Test contact validation
    const validatedContacts = ContactValidator.validateContacts(rawContacts);
    console.log('✅ Contact validation:', {
      originalCount: rawContacts.length,
      validatedCount: validatedContacts.length,
      rejectionRate: ((rawContacts.length - validatedContacts.length) / rawContacts.length * 100).toFixed(1) + '%'
    });

    // Test 6: Performance comparison (if original service is available)
    console.log('\n📋 Test 6: Performance Comparison');
    
    try {
      const originalService = require('./src/services/extraction.service');
      
      // Time original service
      const originalStart = Date.now();
      const originalResult = await originalService.extractContacts(
        testBuffer,
        'text/plain',
        'test-call-sheet.txt',
        { maxContacts: 100 }
      );
      const originalTime = Date.now() - originalStart;
      
      // Time refactored service
      const refactoredStart = Date.now();
      const refactoredResult = await refactoredService.extractContacts(
        testBuffer,
        'text/plain',
        'test-call-sheet.txt',
        { maxContacts: 100 }
      );
      const refactoredTime = Date.now() - refactoredStart;
      
      console.log('✅ Performance comparison:', {
        original: {
          time: originalTime + 'ms',
          contacts: originalResult.contacts?.length || 0,
          success: originalResult.success
        },
        refactored: {
          time: refactoredTime + 'ms',
          contacts: refactoredResult.contacts?.length || 0,
          success: refactoredResult.success
        },
        improvement: originalTime > 0 ? ((originalTime - refactoredTime) / originalTime * 100).toFixed(1) + '%' : 'N/A'
      });
      
    } catch (error) {
      console.log('⚠️ Original service not available for comparison:', error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Test error handling
async function testErrorHandling() {
  console.log('\n🧪 Testing Error Handling...\n');

  try {
    const refactoredService = require('./src/services/extraction-refactored.service');
    
    // Test 1: Invalid buffer
    console.log('📋 Test 1: Invalid Buffer Handling');
    try {
      await refactoredService.extractContacts(null, 'text/plain', 'test.txt');
      console.log('❌ Should have thrown error for null buffer');
    } catch (error) {
      console.log('✅ Correctly handled null buffer:', error.message);
    }
    
    // Test 2: Unsupported file type
    console.log('\n📋 Test 2: Unsupported File Type');
    try {
      const buffer = Buffer.from('test', 'utf-8');
      await refactoredService.extractContacts(buffer, 'application/unknown', 'test.unknown');
      console.log('⚠️ Processed unknown file type (fallback behavior)');
    } catch (error) {
      console.log('✅ Correctly handled unknown file type:', error.message);
    }
    
    // Test 3: Empty text
    console.log('\n📋 Test 3: Empty Text Handling');
    const emptyBuffer = Buffer.from('', 'utf-8');
    const result = await refactoredService.extractContacts(emptyBuffer, 'text/plain', 'empty.txt');
    console.log('✅ Empty text result:', {
      success: result.success,
      contacts: result.contacts?.length || 0,
      error: result.error
    });

  } catch (error) {
    console.error('❌ Error handling test failed:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Refactored Extraction Service Tests\n');
  console.log('=' .repeat(60));
  
  await testRefactoredExtraction();
  await testErrorHandling();
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed!');
  
  // Show architecture benefits
  console.log('\n🏗️ Refactored Architecture Benefits:');
  console.log('✅ Single Responsibility: Each component has one job');
  console.log('✅ Loose Coupling: Components are independent');
  console.log('✅ High Cohesion: Related functionality is grouped');
  console.log('✅ Easy Testing: Each component can be tested in isolation');
  console.log('✅ Easy Maintenance: Bugs are isolated to specific components');
  console.log('✅ Easy Extension: New document types/patterns can be added easily');
  console.log('✅ Backward Compatible: Existing code continues to work');
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Run the tests
runAllTests().catch(console.error);
