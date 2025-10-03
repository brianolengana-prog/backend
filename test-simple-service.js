const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Import the simple extraction service
const simpleExtractionService = require('./src/services/simpleExtraction.service');

async function testSimpleService() {
  console.log('🧪 Testing Simple Extraction Service...\n');

  try {
    // Test 1: Create a test call sheet
    console.log('📁 Test 1: Creating test call sheet...');
    const testFilePath = path.join(__dirname, 'test-callsheet.txt');
    
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

DIRECTOR
Tom Davis
tom.davis@email.com
+1-555-0127

ASSISTANT
Jane Doe
jane.doe@email.com
+1-555-0128
    `;
    
    fs.writeFileSync(testFilePath, testContent);
    console.log('✅ Test file created');

    // Test 2: Test extraction
    console.log('\n🔍 Test 2: Testing extraction...');
    const fileBuffer = fs.readFileSync(testFilePath);
    
    const testUserId = uuidv4();
    const extractionResult = await simpleExtractionService.extractContacts(
      fileBuffer,
      'text/plain',
      'test-callsheet.txt',
      {
        userId: testUserId,
        rolePreferences: ['MUA', 'Stylist', 'Photographer', 'Producer', 'Director', 'Assistant']
      }
    );
    
    console.log('\n📊 Extraction result:', {
      success: extractionResult.success,
      contactsFound: extractionResult.contacts?.length || 0,
      processingTime: extractionResult.processingTime || 'N/A',
      strategy: extractionResult.metadata?.strategy || 'unknown'
    });

    if (extractionResult.success && extractionResult.contacts?.length > 0) {
      console.log('\n🎉 SUCCESS! Simple extraction is working!');
      console.log('📋 Extracted contacts:');
      extractionResult.contacts.forEach((contact, index) => {
        console.log(`  ${index + 1}. ${contact.name} (${contact.role})`);
        if (contact.email) console.log(`     Email: ${contact.email}`);
        if (contact.phone) console.log(`     Phone: ${contact.phone}`);
        console.log('');
      });
    } else {
      console.log('\n❌ FAILED! No contacts extracted.');
      console.log('Debug info:', {
        success: extractionResult.success,
        error: extractionResult.error,
        metadata: extractionResult.metadata
      });
    }

    // Test 3: Test with different format
    console.log('\n🔍 Test 3: Testing different format...');
    const testContent2 = `
Name - Role - Email - Phone
Alice Cooper - PHOTOGRAPHER - alice@email.com - +1-555-1001
Bob Smith - MUA - bob@email.com - +1-555-1002
Charlie Brown - STYLIST - charlie@email.com - +1-555-1003
    `;
    
    const testFilePath2 = path.join(__dirname, 'test-callsheet2.txt');
    fs.writeFileSync(testFilePath2, testContent2);
    
    const fileBuffer2 = fs.readFileSync(testFilePath2);
    const extractionResult2 = await simpleExtractionService.extractContacts(
      fileBuffer2,
      'text/plain',
      'test-callsheet2.txt',
      {
        userId: testUserId,
        rolePreferences: ['MUA', 'Stylist', 'Photographer']
      }
    );
    
    console.log('📊 Format 2 result:', {
      success: extractionResult2.success,
      contactsFound: extractionResult2.contacts?.length || 0
    });

    if (extractionResult2.success && extractionResult2.contacts?.length > 0) {
      console.log('✅ Format 2 also works!');
      extractionResult2.contacts.forEach((contact, index) => {
        console.log(`  ${index + 1}. ${contact.name} (${contact.role}) - ${contact.email}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    // Cleanup
    try {
      const testFiles = ['test-callsheet.txt', 'test-callsheet2.txt'];
      testFiles.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      console.log('\n🧹 Cleaned up test files');
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup warning:', cleanupError.message);
    }
  }
}

// Run the test
testSimpleService().catch(console.error);
