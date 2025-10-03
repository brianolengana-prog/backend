/**
 * Test PDF Processing Fix
 * Tests the Uint8Array conversion fix for PDF.js compatibility
 */

const fs = require('fs');
const path = require('path');

async function testPDFFix() {
  console.log('🧪 Testing PDF Processing Fix\n');
  
  try {
    const hybridExtractionService = require('./src/services/hybridExtraction.service');
    
    // Create a simple text file that we'll treat as PDF to test the conversion
    const testContent = `
CALL SHEET - "Test Production"

John Smith - Director
Email: john.smith@test.com
Phone: (555) 123-4567

Sarah Johnson - Producer
Email: sarah.j@test.com
Phone: (555) 987-6543
`;

    const fileBuffer = Buffer.from(testContent, 'utf8');
    const fileName = 'test-call-sheet.pdf';
    const mimeType = 'application/pdf';
    const options = {
      userId: 'test-user-123',
      extractionMethod: 'hybrid'
    };

    console.log('📄 Testing PDF processing with Uint8Array fix...');
    console.log('📊 File Size:', fileBuffer.length, 'bytes');
    console.log('🎯 Expected: No Buffer/Uint8Array errors\n');

    const startTime = Date.now();
    
    try {
      const result = await hybridExtractionService.extractContacts(
        fileBuffer,
        mimeType,
        fileName,
        options
      );
      
      const processingTime = Date.now() - startTime;
      
      console.log('✅ PDF Processing Results:');
      console.log('========================');
      console.log(`⏱️  Processing Time: ${processingTime}ms`);
      console.log(`📋 Contacts Found: ${result.contacts?.length || 0}`);
      console.log(`🎯 Extraction Method: ${result.metadata?.extractionMethod || 'unknown'}`);
      
      if (result.contacts && result.contacts.length > 0) {
        console.log('\n📞 Extracted Contacts:');
        result.contacts.forEach((contact, index) => {
          console.log(`${index + 1}. ${contact.name || 'N/A'}`);
          console.log(`   Email: ${contact.email || 'N/A'}`);
          console.log(`   Phone: ${contact.phone || 'N/A'}`);
          console.log(`   Role: ${contact.role || 'N/A'}`);
        });
      }
      
      console.log('\n🎉 PDF processing test completed successfully!');
      console.log('✅ No Buffer/Uint8Array conversion errors!');
      
    } catch (error) {
      if (error.message.includes('Buffer') || error.message.includes('Uint8Array')) {
        console.log('❌ PDF processing still has Buffer/Uint8Array issues:');
        console.log('Error:', error.message);
      } else {
        console.log('⚠️ PDF processing failed for other reasons:');
        console.log('Error:', error.message);
        console.log('This might be expected for non-PDF content.');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the PDF test
testPDFFix();
