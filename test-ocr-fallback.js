/**
 * Test OCR Fallback for Scanned PDFs
 */

const extractionService = require('./src/services/extraction.service');

async function testOCRFallback() {
  try {
    console.log('🧪 Testing OCR fallback for scanned PDFs...');
    
    // Create a test buffer that simulates a scanned PDF (very little text)
    const testText = "--- Page 1 ---\n"; // This should trigger OCR fallback
    const testBuffer = Buffer.from(testText, 'utf8');
    
    console.log('📄 Test text length:', testText.length);
    console.log('📄 Test text preview:', testText);
    
    // Test the PDF extraction
    const result = await extractionService.extractTextFromPDF(testBuffer);
    
    console.log('\n✅ OCR fallback test results:');
    console.log(`📊 Extracted text length: ${result.length}`);
    console.log(`📊 Extracted text preview: ${result.substring(0, 200)}`);
    
    if (result.length > testText.length) {
      console.log('✅ OCR fallback was triggered and improved extraction');
    } else {
      console.log('⚠️ OCR fallback was not triggered or did not improve extraction');
    }
    
    console.log('\n✅ OCR fallback test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testOCRFallback();
