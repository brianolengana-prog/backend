const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Import our services
const optimizedHybridExtractionService = require('./src/services/optimizedHybridExtraction.service');

async function testSimpleExtraction() {
  console.log('🧪 Starting simple extraction test...\n');

  try {
    // Test 1: Create a simple text file (not PDF to avoid PDF processing issues)
    console.log('📁 Test 1: Creating test file...');
    const testFilePath = path.join(__dirname, 'test-callsheet.txt');
    
    // Create a simple call sheet content
    const testContent = `
CALL SHEET - SEPTEMBER 2025

PHOTOGRAPHER
John Smith
john.smith@email.com
+1-555-0123

MUA
Sarah Johnson
sarah.j@email.com
+1-555-0124

STYLIST
Mike Wilson
mike.wilson@email.com
+1-555-0125

PRODUCER
Lisa Brown
lisa.brown@email.com
+1-555-0126
    `;
    
    fs.writeFileSync(testFilePath, testContent);
    console.log('✅ Test file created:', testFilePath);

    // Test 2: Test direct extraction with text file
    console.log('\n🔍 Test 2: Testing direct extraction...');
    const fileBuffer = fs.readFileSync(testFilePath);
    
    const testUserId = uuidv4();
    const extractionResult = await optimizedHybridExtractionService.extractContacts(
      fileBuffer,
      'text/plain',
      'test-callsheet.txt',
      {
        userId: testUserId,
        rolePreferences: ['MUA', 'Stylist', 'Photographer', 'Producer']
      }
    );
    
    console.log('📊 Extraction result:', {
      success: extractionResult.success,
      contactsFound: extractionResult.contacts?.length || 0,
      processingTime: extractionResult.processingTime || 'N/A',
      contacts: extractionResult.contacts?.map(c => ({
        name: c.name,
        role: c.role,
        email: c.email,
        phone: c.phone
      })) || []
    });

    if (extractionResult.success && extractionResult.contacts?.length > 0) {
      console.log('\n🎉 SUCCESS! Extraction is working!');
      console.log('📋 Extracted contacts:');
      extractionResult.contacts.forEach((contact, index) => {
        console.log(`  ${index + 1}. ${contact.name} (${contact.role}) - ${contact.email} - ${contact.phone}`);
      });
    } else {
      console.log('\n❌ FAILED! Extraction is not working properly.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    // Cleanup
    try {
      const testFilePath = path.join(__dirname, 'test-callsheet.txt');
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
        console.log('\n🧹 Cleaned up test file');
      }
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup warning:', cleanupError.message);
    }
  }
}

// Run the test
testSimpleExtraction().catch(console.error);
