/**
 * Quick Test Script for Enterprise Extractor
 * 
 * Run: node test-enterprise-extractor.js
 */

const EnterpriseExtractionService = require('./src/services/enterprise/EnterpriseExtractionService');

// Test data - real call sheet format
const testCallSheet = `
Call Sheet: SS26 Editorial 9.19
Date: 09.19.2025
Call Time: 7:55 AM
Location: 72 Greene Ave, Brooklyn NY

Crew
Photographer: Coni Tarallo / 929.250.6798
1st Photo Assistant: Asa Lory / 573.823.9705
2nd Photo Assistant: Kevin Mathien / 312.519.0901
Digitech: William Manchuck / 860.888.2173
1st Videographer: Christian Hernandez / 917.769.6922
2nd Videographer: Angeline Quintilla / 510.402.9371

Talent
Model: BIANCA FELICIANO / Ford - Brett Pougnet / 917.783.8966
Model: TEHYA / JAG - Adam Hughes / 917-539-9577
Model: LYDIA WALDROP / Supreme - Taylor Warren / 212-380-6538

Casting Director: Anna Jozwaik / 917.283.0789‬
1st Production Assistant: Edwin Blas / 201.772.7141
2nd Production Assistant: Ramon Vasquez / 678.600.1266

Hair & Makeup
MUA: Yuko Kawashima / 646.578.2704
HUA: Juli Akaneya / 201.647.7724
HMUA: Mariolga Pantazopoulos / 617.590.9160

Styling
Stylist: Francesca Tonelli / 774.571.9338
Stylist: Danielle Dinten / 347.420.8522
Stylist Assistant: Morgan / 704.626.0999

Driver: Mahmoud Ebid / 646.575.0323

Marcella Team
Chief Creative Director: Siyana Huszar / (678) 386-4536
Jr. Creative Director: Eva Chung / (413) 695-2939
Designer: Emily James / (201) 563-8063
Social Manager: Kara Quinteros / (678) 386.4536
Social Assistant: Chloe / 443.608.7724
Social Assistant: Zoë Claywell / 912.677.3951
Production Manager: Melanie Morriss / (512) 554-8615‬
`;

async function runTest() {
  console.log('🧪 Testing Enterprise Component-First Extractor\n');
  console.log('═'.repeat(70));
  
  try {
    const startTime = Date.now();
    
    // Extract contacts
    const result = await EnterpriseExtractionService.extractContacts(testCallSheet, {
      extractionId: 'test_run_001'
    });
    
    const processingTime = Date.now() - startTime;
    
    console.log('\n✅ EXTRACTION COMPLETE\n');
    console.log('═'.repeat(70));
    
    // Display results
    console.log('\n📊 SUMMARY:');
    console.log('─'.repeat(70));
    console.log(`✓ Success:              ${result.success}`);
    console.log(`✓ Contacts Found:       ${result.contacts.length}`);
    console.log(`✓ Quality Grade:        ${result.quality.grade}`);
    console.log(`✓ Average Confidence:   ${result.quality.averageConfidence}`);
    console.log(`✓ Processing Time:      ${processingTime}ms`);
    console.log(`✓ Rejection Rate:       ${result.quality.rejectionRate}`);
    console.log(`✓ Recommendation:       ${result.quality.recommendation}`);
    
    console.log('\n📋 COMPONENTS FOUND:');
    console.log('─'.repeat(70));
    console.log(`✓ Roles:                ${result.metadata.components.rolesFound}`);
    console.log(`✓ Names:                ${result.metadata.components.namesFound}`);
    console.log(`✓ Phones:               ${result.metadata.components.phonesFound}`);
    console.log(`✓ Emails:               ${result.metadata.components.emailsFound}`);
    
    console.log('\n👥 EXTRACTED CONTACTS:');
    console.log('═'.repeat(70));
    
    // Display contacts
    result.contacts.forEach((contact, index) => {
      console.log(`\n${index + 1}. ${contact.name}`);
      console.log(`   Role:       ${contact.role}`);
      console.log(`   Phone:      ${contact.phone || '(none)'}`);
      console.log(`   Email:      ${contact.email || '(none)'}`);
      console.log(`   Confidence: ${(contact.confidence * 100).toFixed(0)}%`);
      console.log(`   Source:     ${contact.source}`);
    });
    
    console.log('\n═'.repeat(70));
    console.log('\n📈 SERVICE METRICS:');
    console.log('─'.repeat(70));
    
    const metrics = EnterpriseExtractionService.getMetrics();
    console.log(`✓ Total Extractions:       ${metrics.totalExtractions}`);
    console.log(`✓ Success Rate:            ${metrics.successRate}`);
    console.log(`✓ Average Confidence:      ${metrics.averageConfidence.toFixed(2)}`);
    console.log(`✓ Average Processing Time: ${metrics.averageProcessingTime.toFixed(0)}ms`);
    console.log(`✓ Contacts Extracted:      ${metrics.contactsExtracted}`);
    console.log(`✓ Avg Contacts/Extract:    ${metrics.averageContactsPerExtraction}`);
    
    console.log('\n═'.repeat(70));
    console.log('\n✅ TEST PASSED!\n');
    
    // Return success
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ TEST FAILED\n');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    process.exit(1);
  }
}

// Run the test
runTest();

