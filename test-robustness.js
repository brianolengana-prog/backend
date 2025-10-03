/**
 * Robustness Test for Hybrid Extraction System
 * Tests different call sheet structures and formats
 */

const fs = require('fs');
const path = require('path');

// Test Case 1: Traditional Call Sheet (Structured)
const traditionalCallSheet = `
CALL SHEET - "The Great Adventure"
Production: Adventure Films LLC
Date: 2024-01-15
Location: Los Angeles, CA

CAST & CREW CONTACTS:

John Smith - Director
Email: john.smith@adventurefilms.com
Phone: (555) 123-4567
Role: Director

Sarah Johnson - Producer  
Email: sarah.j@adventurefilms.com
Phone: (555) 987-6543
Role: Producer
`;

// Test Case 2: Unstructured Call Sheet (Freeform)
const unstructuredCallSheet = `
PRODUCTION CALL SHEET

Hey everyone, here are the contacts for tomorrow's shoot:

John Smith is our director - john.smith@adventurefilms.com or call him at 555-123-4567
Sarah Johnson will be producing - sarah.j@adventurefilms.com, 555-987-6543
Mike Wilson is handling camera work - mike.wilson@cinematography.com, 555-456-7890
Lisa Brown is our production manager - lisa.brown@adventurefilms.com, 555-321-0987

See you all tomorrow!
`;

// Test Case 3: Tabular Format (CSV-like)
const tabularCallSheet = `
Name,Role,Email,Phone
John Smith,Director,john.smith@adventurefilms.com,(555) 123-4567
Sarah Johnson,Producer,sarah.j@adventurefilms.com,(555) 987-6543
Mike Wilson,Cinematographer,mike.wilson@cinematography.com,(555) 456-7890
Lisa Brown,Production Manager,lisa.brown@adventurefilms.com,(555) 321-0987
`;

// Test Case 4: Minimal Information (Challenging)
const minimalCallSheet = `
CALL SHEET

John Smith - Director
Sarah Johnson - Producer
Mike Wilson - Camera
Lisa Brown - Production
`;

// Test Case 5: Mixed Format (Complex)
const mixedCallSheet = `
PRODUCTION CALL SHEET - "The Great Adventure"

DIRECTOR: John Smith
Email: john.smith@adventurefilms.com
Phone: (555) 123-4567

PRODUCER: Sarah Johnson
Email: sarah.j@adventurefilms.com
Phone: (555) 987-6543

CREW:
- Mike Wilson (Cinematographer) - mike.wilson@cinematography.com, 555-456-7890
- Lisa Brown (Production Manager) - lisa.brown@adventurefilms.com, 555-321-0987
- Alex Davis (Sound) - alex.davis@soundpro.com, 555-654-3210

TALENT:
- Jennifer Adams (Lead Actress) - jennifer.adams@talent.com, 555-369-2580
- Robert Clark (Lead Actor) - robert.clark@talent.com, 555-258-1470
`;

async function testRobustness() {
  console.log('🧪 Testing Hybrid Extraction System Robustness\n');
  
  const testCases = [
    {
      name: 'Traditional Call Sheet',
      content: traditionalCallSheet,
      expectedContacts: 2,
      description: 'Structured format with clear sections'
    },
    {
      name: 'Unstructured Call Sheet',
      content: unstructuredCallSheet,
      expectedContacts: 4,
      description: 'Freeform text with embedded contact info'
    },
    {
      name: 'Tabular Format',
      content: tabularCallSheet,
      expectedContacts: 4,
      description: 'CSV-like tabular structure'
    },
    {
      name: 'Minimal Information',
      content: minimalCallSheet,
      expectedContacts: 4,
      description: 'Names and roles only, no contact details'
    },
    {
      name: 'Mixed Format',
      content: mixedCallSheet,
      expectedContacts: 7,
      description: 'Complex mixed structure with various formats'
    }
  ];

  try {
    const hybridExtractionService = require('./src/services/hybridExtraction.service');
    
    let totalTests = 0;
    let successfulTests = 0;
    let totalContacts = 0;
    let totalProcessingTime = 0;

    for (const testCase of testCases) {
      console.log(`\n📋 Testing: ${testCase.name}`);
      console.log(`📝 Description: ${testCase.description}`);
      console.log(`🎯 Expected Contacts: ${testCase.expectedContacts}`);
      console.log('─'.repeat(50));

      const fileBuffer = Buffer.from(testCase.content, 'utf8');
      const fileName = `${testCase.name.toLowerCase().replace(/\s+/g, '-')}.txt`;
      const mimeType = 'text/plain';
      const options = {
        userId: 'test-user-123',
        extractionMethod: 'hybrid'
      };

      const startTime = Date.now();
      
      try {
        const result = await hybridExtractionService.extractContacts(
          fileBuffer,
          mimeType,
          fileName,
          options
        );
        
        const processingTime = Date.now() - startTime;
        totalProcessingTime += processingTime;
        totalTests++;
        
        const contactsFound = result.contacts?.length || 0;
        const success = contactsFound > 0;
        
        if (success) {
          successfulTests++;
          totalContacts += contactsFound;
        }

        console.log(`✅ Contacts Found: ${contactsFound}`);
        console.log(`⏱️  Processing Time: ${processingTime}ms`);
        console.log(`🎯 Extraction Method: ${result.metadata?.extractionMethod || 'unknown'}`);
        console.log(`⭐ Quality Score: ${result.metadata?.qualityScore?.toFixed(2) || 'N/A'}`);
        
        if (result.metadata?.simpleTime) {
          console.log(`⚡ Simple Time: ${result.metadata.simpleTime}ms`);
        }
        if (result.metadata?.aiTime) {
          console.log(`🤖 AI Time: ${result.metadata.aiTime}ms`);
        }

        // Show sample contacts
        if (contactsFound > 0) {
          console.log('\n📞 Sample Contacts:');
          result.contacts.slice(0, 3).forEach((contact, index) => {
            console.log(`  ${index + 1}. ${contact.name || 'N/A'} (${contact.role || 'N/A'})`);
            if (contact.email) console.log(`     Email: ${contact.email}`);
            if (contact.phone) console.log(`     Phone: ${contact.phone}`);
          });
          if (contactsFound > 3) {
            console.log(`  ... and ${contactsFound - 3} more`);
          }
        }

        console.log(`\n${success ? '✅' : '❌'} Test ${success ? 'PASSED' : 'FAILED'}`);
        
      } catch (error) {
        console.log(`❌ Test FAILED: ${error.message}`);
        totalTests++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 ROBUSTNESS TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Successful Tests: ${successfulTests}`);
    console.log(`Success Rate: ${((successfulTests / totalTests) * 100).toFixed(1)}%`);
    console.log(`Total Contacts Found: ${totalContacts}`);
    console.log(`Average Contacts per Test: ${(totalContacts / successfulTests).toFixed(1)}`);
    console.log(`Total Processing Time: ${totalProcessingTime}ms`);
    console.log(`Average Processing Time: ${(totalProcessingTime / totalTests).toFixed(0)}ms`);

    // Performance stats
    const stats = hybridExtractionService.getStats();
    console.log('\n📈 System Performance Stats:');
    console.log(`Total Extractions: ${stats.totalExtractions}`);
    console.log(`Simple Success Rate: ${stats.simpleSuccessRate.toFixed(1)}%`);
    console.log(`Hybrid Success Rate: ${stats.hybridSuccessRate.toFixed(1)}%`);
    console.log(`Average Simple Time: ${stats.averageSimpleTime.toFixed(0)}ms`);
    console.log(`Average Hybrid Time: ${stats.averageHybridTime.toFixed(0)}ms`);

    console.log('\n🎉 Robustness testing completed!');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the robustness test
testRobustness();
