/**
 * Test script to verify extraction fixes
 */

const fs = require('fs');
const path = require('path');

// Test the extraction service directly
async function testExtractionService() {
  console.log('🧪 Testing Extraction Service Fixes...\n');

  try {
    // Test 1: Buffer/Uint8Array conversion
    console.log('📋 Test 1: Buffer/Uint8Array Conversion');
    const extractionService = require('./src/services/extraction.service');
    
    // Create a test buffer
    const testBuffer = Buffer.from('Test PDF content', 'utf-8');
    console.log('✅ Buffer created:', {
      type: testBuffer.constructor.name,
      length: testBuffer.length,
      isBuffer: testBuffer instanceof Buffer
    });

    // Test 2: Simple text extraction
    console.log('\n📋 Test 2: Simple Text Extraction');
    const simpleText = `
PHOTOGRAPHER: John Smith / 555-123-4567
MUA: Jane Doe / 555-987-6543
STYLIST: Bob Wilson
555-555-5555
MODEL: Sarah Johnson / Agency XYZ / 555-111-2222
    `;
    
    const simpleService = require('./src/services/simpleExtraction.service');
    
    const contacts = await simpleService.extractContactsFromText(simpleText, {
      maxContacts: 100,
      maxProcessingTime: 5000
    });
    
    console.log('✅ Simple extraction results:', {
      contactsFound: contacts.length,
      contacts: contacts.map(c => ({ name: c.name, role: c.role, phone: c.phone }))
    });

    // Test 3: Adaptive extraction service
    console.log('\n📋 Test 3: Adaptive Extraction Service');
    const adaptiveService = require('./src/services/adaptiveExtraction.service');
    
    const testTextBuffer = Buffer.from(simpleText, 'utf-8');
    const adaptiveResult = await adaptiveService.extractContacts(
      testTextBuffer,
      'text/plain',
      'test-call-sheet.txt',
      { maxContacts: 100 }
    );
    
    console.log('✅ Adaptive extraction results:', {
      success: adaptiveResult.success,
      contactsFound: adaptiveResult.contacts?.length || 0,
      strategy: adaptiveResult.metadata?.strategy,
      error: adaptiveResult.error
    });

    // Test 4: Health check
    console.log('\n📋 Test 4: Service Health Check');
    const healthStatus = adaptiveService.getHealthStatus();
    console.log('✅ Health status:', healthStatus);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Test PDF processing specifically
async function testPDFProcessing() {
  console.log('\n🧪 Testing PDF Processing...\n');

  try {
    const extractionService = require('./src/services/extraction.service');
    
    // Create a mock PDF buffer (this won't be a real PDF, just testing the conversion logic)
    const mockPDFBuffer = Buffer.alloc(1000, 'PDF test data');
    
    console.log('📋 Testing Buffer conversion logic');
    console.log('Original buffer:', {
      type: mockPDFBuffer.constructor.name,
      length: mockPDFBuffer.length,
      isBuffer: mockPDFBuffer instanceof Buffer,
      hasBuffer: 'buffer' in mockPDFBuffer,
      hasByteOffset: 'byteOffset' in mockPDFBuffer,
      hasByteLength: 'byteLength' in mockPDFBuffer
    });

    // Test the conversion logic directly
    let uint8Array;
    if (mockPDFBuffer instanceof Buffer) {
      uint8Array = new Uint8Array(mockPDFBuffer.buffer, mockPDFBuffer.byteOffset, mockPDFBuffer.byteLength);
    }
    
    console.log('✅ Converted to Uint8Array:', {
      type: uint8Array.constructor.name,
      length: uint8Array.length,
      isUint8Array: uint8Array instanceof Uint8Array
    });

  } catch (error) {
    console.error('❌ PDF test failed:', error.message);
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Extraction Service Tests\n');
  console.log('=' .repeat(50));
  
  await testExtractionService();
  await testPDFProcessing();
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ Tests completed!');
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Run the tests
runTests().catch(console.error);
