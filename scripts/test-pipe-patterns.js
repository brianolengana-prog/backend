/**
 * Test script to verify pipe-separated patterns work correctly
 * 
 * Usage: node scripts/test-pipe-patterns.js
 */

const RobustCallSheetExtractor = require('../src/services/robustCallSheetExtractor.service');

// Sample call sheet text with pipe-separated format
const sampleCallSheet = `
CALL SHEET // New York Magazine - The Cut // Accessories Shoot
SHOOT DATE: Friday, January 24, 2024
LOCATION: 85 Broad Street, New York, NY 10004 | Floor 14
Maridelis Morales Rosado | c. 787 934 8623

TALENT:
Chloe King | king.chloe.s@gmail.com| c. 617 875 7447

CREW:
PHOTOGRAPHER: Myrthe Giesbers | Info@myrthegiesbers.com | c. 929 722 0099
c/o Cody Benfield | cody@silvertooth.co | c. 310 909 4912
PHOTO ASSISTANT: Leanna Siupinys | leanna@leannaslens.com | c. 440 525 6609
HAIR: Juli Akaneya | juli.akaneya@gmail.com | c. 201 647 7724
c/o Merimon Hart | merimon@southjames.com
MAKEUP: Alex Levy | c. 617 990 4893
c/o Maddie Hoelzer (agent) | maddie@streeters.com | c. 419 2024127
c/o Sarah Westrick (producer) | sarah.westrick@streeters.com | c. 443 326 9393
SR. SOCIAL EDITOR: Sasha Mutchnik | sasha.mutchnik@voxmedia.com | c. 213 453 1210
FASHION MARKET EDITOR: Emma Olek | emma.olek@voxmedia.com | c. 727 303 2815
SHOPPING EDITOR: Hanna Flanagan | hanna.flanagan@voxmedia.com | c. 573 268 5975

NY MAG / THE CUT:
PHOTO DIRECTOR, THE CUT: Noelle Lacombe | noelle.lacombe@voxmedia.com | c. 954 604 1166
PHOTO EDITOR: Maridelis Morales Rosado | maridelis.morales@voxmedia.com | c. 787 934 8623
STYLE DIRECTOR, THE CUT: Jessica Willis
PHOTO DIRECTOR: Jody Quon
EDITOR IN CHIEF, THE CUT: Lindsay Peoples
`;

async function testExtraction() {
  console.log('🧪 Testing pipe-separated pattern extraction...\n');
  
  const extractor = new RobustCallSheetExtractor();
  
  // Enable debug mode
  process.env.EXTRACTION_DEBUG = 'true';
  
  const result = await extractor.extractContacts(sampleCallSheet, {
    extractionId: 'test_pipe_patterns'
  });
  
  console.log('\n📊 Extraction Results:');
  console.log('='.repeat(60));
  console.log(`Total Contacts Found: ${result.contacts.length}`);
  console.log(`Success: ${result.success}`);
  console.log(`Processing Time: ${result.metadata.processingTime}ms`);
  console.log(`Patterns Used:`, result.metadata.patternsUsed);
  
  console.log('\n📋 Extracted Contacts:');
  console.log('='.repeat(60));
  result.contacts.forEach((contact, index) => {
    console.log(`\n${index + 1}. ${contact.name || 'Unknown'}`);
    console.log(`   Role: ${contact.role || 'N/A'}`);
    console.log(`   Email: ${contact.email || 'N/A'}`);
    console.log(`   Phone: ${contact.phone || 'N/A'}`);
    console.log(`   Source: ${contact.source || 'N/A'}`);
    console.log(`   Pattern: ${contact.patternName || 'N/A'}`);
    console.log(`   Confidence: ${contact.confidence || 'N/A'}`);
  });
  
  // Expected contacts from sample
  const expectedContacts = [
    'Chloe King',
    'Myrthe Giesbers',
    'Cody Benfield',
    'Leanna Siupinys',
    'Juli Akaneya',
    'Merimon Hart',
    'Alex Levy',
    'Maddie Hoelzer',
    'Sarah Westrick',
    'Sasha Mutchnik',
    'Emma Olek',
    'Hanna Flanagan',
    'Noelle Lacombe',
    'Maridelis Morales Rosado'
  ];
  
  console.log('\n✅ Validation:');
  console.log('='.repeat(60));
  const foundNames = result.contacts.map(c => c.name);
  const missing = expectedContacts.filter(name => !foundNames.includes(name));
  
  if (missing.length === 0) {
    console.log('✅ All expected contacts found!');
  } else {
    console.log(`⚠️  Missing ${missing.length} expected contacts:`);
    missing.forEach(name => console.log(`   - ${name}`));
  }
  
  // Check pattern distribution
  const patternCounts = {};
  result.contacts.forEach(contact => {
    const pattern = contact.patternName || 'unknown';
    patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
  });
  
  console.log('\n📈 Pattern Distribution:');
  console.log('='.repeat(60));
  Object.entries(patternCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([pattern, count]) => {
      console.log(`   ${pattern}: ${count}`);
    });
  
  // Check if pipe patterns were used
  const pipePatterns = Object.keys(patternCounts).filter(p => p.includes('pipe'));
  if (pipePatterns.length > 0) {
    console.log('\n✅ Pipe-separated patterns are working!');
    console.log(`   Patterns used: ${pipePatterns.join(', ')}`);
  } else {
    console.log('\n⚠️  No pipe-separated patterns matched. Check pattern regex.');
  }
  
  return result;
}

// Run test
testExtraction()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

