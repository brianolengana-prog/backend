/**
 * Test Buffer to Uint8Array conversion
 */

function testBufferConversion() {
  console.log('🧪 Testing Buffer to Uint8Array conversion...\n');

  // Create a test buffer
  const testBuffer = Buffer.from('Hello, World! This is a test PDF buffer content.', 'utf-8');
  
  console.log('📋 Original Buffer:', {
    type: testBuffer.constructor.name,
    length: testBuffer.length,
    isBuffer: testBuffer instanceof Buffer,
    isUint8Array: testBuffer instanceof Uint8Array,
    hasBuffer: 'buffer' in testBuffer,
    hasByteOffset: 'byteOffset' in testBuffer,
    hasByteLength: 'byteLength' in testBuffer,
    first5Bytes: Array.from(testBuffer.slice(0, 5))
  });

  // Test the old problematic conversion
  console.log('\n❌ Old problematic conversion:');
  try {
    const oldConversion = new Uint8Array(testBuffer.buffer, testBuffer.byteOffset, testBuffer.byteLength);
    console.log('Old conversion result:', {
      type: oldConversion.constructor.name,
      length: oldConversion.length,
      isUint8Array: oldConversion instanceof Uint8Array,
      first5Bytes: Array.from(oldConversion.slice(0, 5))
    });
  } catch (error) {
    console.log('Old conversion failed:', error.message);
  }

  // Test the new reliable conversion
  console.log('\n✅ New reliable conversion:');
  const newConversion = new Uint8Array(testBuffer.length);
  for (let i = 0; i < testBuffer.length; i++) {
    newConversion[i] = testBuffer[i];
  }
  
  console.log('New conversion result:', {
    type: newConversion.constructor.name,
    length: newConversion.length,
    isUint8Array: newConversion instanceof Uint8Array,
    first5Bytes: Array.from(newConversion.slice(0, 5)),
    matches: JSON.stringify(Array.from(testBuffer.slice(0, 5))) === JSON.stringify(Array.from(newConversion.slice(0, 5)))
  });

  // Test with actual PDF-like data
  console.log('\n📄 Testing with PDF-like binary data:');
  const pdfLikeBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]); // %PDF-1.4
  
  const pdfUint8Array = new Uint8Array(pdfLikeBuffer.length);
  for (let i = 0; i < pdfLikeBuffer.length; i++) {
    pdfUint8Array[i] = pdfLikeBuffer[i];
  }
  
  console.log('PDF-like conversion:', {
    originalBytes: Array.from(pdfLikeBuffer),
    convertedBytes: Array.from(pdfUint8Array),
    matches: JSON.stringify(Array.from(pdfLikeBuffer)) === JSON.stringify(Array.from(pdfUint8Array)),
    asString: String.fromCharCode(...pdfUint8Array)
  });

  console.log('\n✅ Buffer conversion test completed!');
}

// Run the test
testBufferConversion();
