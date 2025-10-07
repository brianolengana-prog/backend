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

// Test various patterns
const patterns = [
  {
    name: 'Simple role: name / contact',
    regex: /([A-Z][A-Z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*\/\s*([^\n\r]+)/g
  },
  {
    name: 'Very simple role: name / contact',
    regex: /([A-Z][A-Z\s]+):\s*([A-Za-z\s\-'\.]+)\s*\/\s*([^\n\r]+)/g
  },
  {
    name: 'Role with colon and slash',
    regex: /([A-Z][A-Z\s]+):\s*([A-Za-z\s\-'\.]+)\s*\/\s*([^\n\r]+)/g
  },
  {
    name: 'Any colon pattern',
    regex: /([A-Z][A-Z\s]+):\s*([A-Za-z\s\-'\.]+)\s*\/\s*([^\n\r]+)/g
  }
];

patterns.forEach((pattern, index) => {
  console.log(`\n${index + 1}. Testing: ${pattern.name}`);
  console.log(`Pattern: ${pattern.regex}`);
  
  const matches = [...complexSheet.matchAll(pattern.regex)];
  console.log(`Matches: ${matches.length}`);
  
  if (matches.length > 0) {
    matches.slice(0, 3).forEach((match, i) => {
      console.log(`  ${i + 1}. "${match[0]}"`);
      console.log(`     Role: "${match[1]}"`);
      console.log(`     Name: "${match[2]}"`);
      console.log(`     Contact: "${match[3]}"`);
    });
  }
});

// Test line by line
console.log('\n\n🔍 Testing line by line...');
const lines = complexSheet.split('\n');
lines.forEach((line, index) => {
  if (line.includes(':') && line.includes('/')) {
    console.log(`Line ${index}: "${line}"`);
  }
});
