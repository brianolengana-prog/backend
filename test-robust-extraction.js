/**
 * Test Robust Call Sheet Extraction
 * 
 * Tests the new robust extraction system with various call sheet formats
 * to validate reliability across different document structures
 */

const RobustCallSheetExtractor = require('./src/services/robustCallSheetExtractor.service');

async function testRobustExtraction() {
  console.log('🧪 Testing Robust Call Sheet Extraction\n');

  const extractor = new RobustCallSheetExtractor();

  // Test cases with different call sheet formats
  const testCases = [
    {
      name: 'Standard Call Sheet Format',
      content: `
CALL SHEET - August 19, 2025

MAIN CONTACT: Annalisa Gesterkamp / annalisa@primecontact.com / 555-123-4567

PHOTOGRAPHER: John Smith / 555-987-6543
MUA: Jane Doe / jane@makeup.com / 555-555-1234
STYLIST: Bob Wilson / 555-444-5678
PRODUCER: Mike Davis / mike@production.com / 555-333-9999

TALENT:
MODEL: Sarah Johnson / Agency XYZ / 555-111-2222
MODEL: Tom Anderson / Elite Models / 555-222-3333
      `,
      expectedContacts: 7
    },
    {
      name: 'Minimal Format',
      content: `
Photographer: John Smith - 555-123-4567
MUA: Jane Doe (555-987-6543)
Stylist: Bob Wilson
      `,
      expectedContacts: 3
    },
    {
      name: 'Multi-line Format',
      content: `
CREW:
Photographer: John Smith
555-123-4567

MUA: Jane Doe
555-987-6543
jane@makeup.com

Stylist: Bob Wilson
555-444-5678
      `,
      expectedContacts: 3
    },
    {
      name: 'Unstructured Format',
      content: `
John Smith 555-123-4567 photographer
Jane Doe jane@makeup.com makeup artist
Bob Wilson 555-444-5678 stylist
      `,
      expectedContacts: 3
    },
    {
      name: 'Complex Production Sheet',
      content: `
PRODUCTION CALL SHEET
Date: August 19, 2025

PRODUCTION TEAM:
Producer: Mike Davis / mike@production.com / 555-333-9999
Director: Sarah Johnson / sarah@director.com / 555-111-2222
Line Producer: Tom Anderson / tom@lineprod.com / 555-222-3333

CREW:
Director of Photography: Alex Brown / 555-444-5555
Camera Operator: Emma Wilson / emma@camera.com / 555-555-6666
Sound Engineer: David Lee / david@sound.com / 555-666-7777

TALENT:
Model: Jessica Taylor / Elite Models / 555-777-8888
Model: Michael Chen / Premier Agency / 555-888-9999

LOCATION:
Location Manager: Lisa Garcia / lisa@location.com / 555-999-0000
      `,
      expectedContacts: 10
    },
    {
      name: 'Fashion Shoot Format',
      content: `
FASHION SHOOT CALL SHEET

PHOTOGRAPHY:
Photographer: Marcus Johnson / marcus@photo.com / 555-123-4567
Assistant: Sarah Williams / 555-234-5678

STYLING:
Fashion Stylist: Amanda Davis / amanda@style.com / 555-345-6789
Stylist Assistant: James Brown / 555-456-7890

BEAUTY:
Hair & Makeup: Jessica Taylor / jessica@beauty.com / 555-567-8901
Makeup Assistant: David Wilson / 555-678-9012

MODELS:
Model 1: Emma Thompson / Next Models / 555-789-0123
Model 2: Alex Rodriguez / IMG Models / 555-890-1234

PRODUCTION:
Producer: Mike Davis / mike@production.com / 555-901-2345
      `,
      expectedContacts: 10
    }
  ];

  let totalTests = 0;
  let passedTests = 0;

  for (const testCase of testCases) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log('─'.repeat(50));

    try {
      const result = await extractor.extractContacts(testCase.content, {
        extractionId: `test_${Date.now()}`
      });

      const contactsFound = result.contacts?.length || 0;
      const success = contactsFound >= testCase.expectedContacts * 0.8; // Allow 20% variance

      totalTests++;
      if (success) {
        passedTests++;
        console.log(`✅ PASSED - Found ${contactsFound} contacts (expected ~${testCase.expectedContacts})`);
      } else {
        console.log(`❌ FAILED - Found ${contactsFound} contacts (expected ~${testCase.expectedContacts})`);
      }

      console.log(`📊 Strategy: ${result.metadata?.strategy}`);
      console.log(`⏱️  Processing time: ${result.metadata?.processingTime}ms`);

      if (result.contacts && result.contacts.length > 0) {
        console.log('📋 Extracted contacts:');
        result.contacts.slice(0, 5).forEach((contact, index) => {
          console.log(`  ${index + 1}. ${contact.name} (${contact.role})`);
          if (contact.phone) console.log(`     Phone: ${contact.phone}`);
          if (contact.email) console.log(`     Email: ${contact.email}`);
        });
        
        if (result.contacts.length > 5) {
          console.log(`  ... and ${result.contacts.length - 5} more`);
        }
      }

    } catch (error) {
      totalTests++;
      console.log(`❌ ERROR - ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} tests passed`);
  console.log(`🎯 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED! Robust extraction is working perfectly!');
  } else if (passedTests >= totalTests * 0.8) {
    console.log('✅ MOSTLY SUCCESSFUL! Robust extraction is working well with minor issues.');
  } else {
    console.log('⚠️  NEEDS IMPROVEMENT! Some patterns need refinement.');
  }

  return { passed: passedTests, total: totalTests };
}

// Run the tests
testRobustExtraction().catch(console.error);
