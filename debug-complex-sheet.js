const RobustCallSheetExtractor = require('./src/services/robustCallSheetExtractor.service');

async function debugComplexSheet() {
  const extractor = new RobustCallSheetExtractor();
  
  const complexSheet = `
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
  `;

  console.log('🔍 Debugging complex production sheet...');
  console.log('Text length:', complexSheet.length);
  
  // Test individual patterns
  const patterns = [
    /([A-Z][A-Z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*\/\s*(\(?[\d\s\-\(\)\.]{8,}\)?)/gm,
    /([A-Z][A-Z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*\/\s*([^\s]+@[^\s]+)\s*\/\s*(\(?[\d\s\-\(\)\.]{8,}\)?)/gm
  ];

  patterns.forEach((pattern, index) => {
    console.log(`\nPattern ${index + 1}:`);
    const matches = [...complexSheet.matchAll(pattern)];
    console.log(`Matches found: ${matches.length}`);
    matches.forEach((match, i) => {
      console.log(`  ${i + 1}. ${match[0]}`);
    });
  });

  // Test the actual extractor
  const result = await extractor.extractContacts(complexSheet);
  console.log('\n📊 Extraction result:');
  console.log('Contacts found:', result.contacts?.length || 0);
  console.log('Strategy:', result.metadata?.strategy);
  console.log('Patterns used:', result.metadata?.patternsUsed);
}

debugComplexSheet().catch(console.error);
