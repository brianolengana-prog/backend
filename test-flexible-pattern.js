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

// Test the very flexible pattern
const pattern = /([A-Z][A-Z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*\/\s*([^\n\r]+)/gm;

console.log('🔍 Testing very flexible pattern...');
console.log('Pattern:', pattern);

const matches = [...complexSheet.matchAll(pattern)];
console.log(`\nMatches found: ${matches.length}`);

matches.forEach((match, i) => {
  console.log(`\n${i + 1}. Full match: "${match[0]}"`);
  console.log(`   Role: "${match[1]}"`);
  console.log(`   Name: "${match[2]}"`);
  console.log(`   Contact: "${match[3]}"`);
});

// Test a simpler pattern
console.log('\n\n🔍 Testing simpler pattern...');
const simplePattern = /([A-Z][A-Z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*\/\s*([^\n\r]+)/g;
const simpleMatches = [...complexSheet.matchAll(simplePattern)];
console.log(`Simple matches found: ${simpleMatches.length}`);

simpleMatches.forEach((match, i) => {
  console.log(`${i + 1}. "${match[0]}"`);
});
