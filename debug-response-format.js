/**
 * Debug Response Format
 * Test what the adaptive extraction service is actually returning
 */

const adaptiveExtractionService = require('./src/services/adaptiveExtraction.service');
const fs = require('fs');

async function debugResponseFormat() {
  console.log('🔍 Testing adaptive extraction response format...\n');

  // Create a test call sheet content
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

  try {
    const testBuffer = Buffer.from(testCallSheet, 'utf-8');
    
    console.log('📋 Testing with sample call sheet...');
    const result = await adaptiveExtractionService.extractContacts(
      testBuffer,
      'text/plain',
      'test-call-sheet.txt',
      {
        userId: 'test-user',
        maxContacts: 1000,
        maxProcessingTime: 15000
      }
    );

    console.log('\n📊 Raw Result Structure:');
    console.log('Type:', typeof result);
    console.log('Keys:', Object.keys(result));
    console.log('Success:', result.success);
    console.log('Contacts type:', typeof result.contacts);
    console.log('Contacts array:', Array.isArray(result.contacts));
    console.log('Contacts length:', result.contacts?.length);

    console.log('\n📋 Full Result Object:');
    console.log(JSON.stringify(result, null, 2));

    if (result.contacts && result.contacts.length > 0) {
      console.log('\n👥 Sample Contacts:');
      result.contacts.slice(0, 3).forEach((contact, index) => {
        console.log(`${index + 1}. ${contact.name} (${contact.role}) - ${contact.phone || contact.email}`);
      });
    }

    // Test what the route would do
    console.log('\n🔍 Route Response Simulation:');
    const routeResponse = {
      success: true,
      jobId: `sync_${Date.now()}`,
      status: 'completed',
      result: {
        contacts: result.contacts || [],
        metadata: result.metadata || {},
        processingTime: result.metadata?.processingTime || 0
      }
    };

    console.log('Route response contacts length:', routeResponse.result.contacts.length);
    console.log('Route response structure:');
    console.log(JSON.stringify(routeResponse, null, 2));

  } catch (error) {
    console.error('❌ Debug test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the debug test
debugResponseFormat();
