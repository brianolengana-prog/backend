/**
 * Test API Response
 * Make a real request to the extraction endpoint to see what's returned
 */

const FormData = require('form-data');
const fetch = require('node-fetch');
const fs = require('fs');

async function testAPIResponse() {
  console.log('🧪 Testing actual API response...\n');

  try {
    // Create a test call sheet file
    const testCallSheet = `
CALL SHEET - August 19, 2025

MAIN CONTACT: Annalisa Gesterkamp / annalisa@primecontact.com / 555-123-4567

PHOTOGRAPHER: John Smith / 555-987-6543
MUA: Jane Doe / jane@makeup.com / 555-555-1234
STYLIST: Bob Wilson / 555-444-5678
PRODUCER: Mike Davis / mike@production.com / 555-333-9999

TALENT:
MODEL: Sarah Johnson / Agency XYZ / 555-111-2222
MODEL: Tom Anderson / Elite Models / 555-222-3333
    `;

    // Write to a temporary file
    const tempFile = './temp-test-call-sheet.txt';
    fs.writeFileSync(tempFile, testCallSheet);

    // Create form data
    const formData = new FormData();
    formData.append('file', fs.createReadStream(tempFile), {
      filename: 'test-call-sheet.txt',
      contentType: 'text/plain'
    });
    formData.append('rolePreferences', JSON.stringify(['MUA', 'Stylist', 'Photographer', 'Producer', 'Director', 'Assistant']));
    formData.append('options', JSON.stringify({}));

    console.log('📤 Making request to extraction endpoint...');
    
    // Make request to the actual API
    const response = await fetch('http://localhost:3001/api/extraction/upload', {
      method: 'POST',
      body: formData,
      headers: {
        // Add any auth headers if needed
        // 'Authorization': 'Bearer your-token-here'
      }
    });

    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const result = await response.json();
      
      console.log('\n✅ API Response received:');
      console.log('Success:', result.success);
      console.log('Status:', result.status);
      console.log('Job ID:', result.jobId);
      
      if (result.result) {
        console.log('Contacts count:', result.result.contacts?.length || 0);
        console.log('Processing time:', result.result.processingTime);
        
        if (result.result.contacts && result.result.contacts.length > 0) {
          console.log('\n👥 Sample contacts from API:');
          result.result.contacts.slice(0, 3).forEach((contact, index) => {
            console.log(`${index + 1}. ${contact.name} (${contact.role}) - ${contact.phone || contact.email}`);
          });
        }
        
        console.log('\n📋 Full API Response Structure:');
        console.log(JSON.stringify(result, null, 2));
      }
    } else {
      const errorText = await response.text();
      console.error('❌ API request failed:', response.status, errorText);
    }

    // Cleanup
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure your backend server is running:');
      console.log('   cd backend-clean');
      console.log('   npm run dev');
    }
  }
}

// Run the test
testAPIResponse();
