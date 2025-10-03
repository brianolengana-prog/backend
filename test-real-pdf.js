const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Import our services
const optimizedHybridExtractionService = require('./src/services/optimizedHybridExtraction.service');

async function testRealPDF() {
  console.log('🧪 Testing with real PDF file...\n');

  try {
    // Check if we have the test PDF file
    const testPdfPath = path.join(__dirname, '..', 'Sept 2025 Call Sheet.pdf');
    
    if (!fs.existsSync(testPdfPath)) {
      console.log('❌ Test PDF file not found. Please place "Sept 2025 Call Sheet.pdf" in the parent directory.');
      console.log('Expected path:', testPdfPath);
      return;
    }

    console.log('📁 Found test PDF:', testPdfPath);
    
    // Read the PDF file
    const fileBuffer = fs.readFileSync(testPdfPath);
    console.log('📊 File size:', fileBuffer.length, 'bytes');

    // Test extraction
    console.log('\n🔍 Testing extraction...');
    const testUserId = uuidv4();
    
    const startTime = Date.now();
    const extractionResult = await optimizedHybridExtractionService.extractContacts(
      fileBuffer,
      'application/pdf',
      'Sept 2025 Call Sheet.pdf',
      {
        userId: testUserId,
        rolePreferences: ['MUA', 'Stylist', 'Photographer', 'Producer', 'Director', 'Assistant']
      }
    );
    const processingTime = Date.now() - startTime;
    
    console.log('\n📊 Extraction result:', {
      success: extractionResult.success,
      contactsFound: extractionResult.contacts?.length || 0,
      processingTime: `${processingTime}ms`,
      strategy: extractionResult.metadata?.strategy || 'unknown'
    });

    if (extractionResult.success && extractionResult.contacts?.length > 0) {
      console.log('\n🎉 SUCCESS! Extraction is working!');
      console.log('📋 Extracted contacts:');
      extractionResult.contacts.forEach((contact, index) => {
        console.log(`  ${index + 1}. ${contact.name || 'Unknown'} (${contact.role || 'Unknown'})`);
        if (contact.email) console.log(`     Email: ${contact.email}`);
        if (contact.phone) console.log(`     Phone: ${contact.phone}`);
        if (contact.company) console.log(`     Company: ${contact.company}`);
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
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testRealPDF().catch(console.error);
