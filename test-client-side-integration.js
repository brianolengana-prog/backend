/**
 * Test Client-Side Integration
 * 
 * Simple test to verify the text processing endpoint works
 */

const express = require('express');
const app = express();

// Middleware
app.use(express.json());

// Mock user authentication middleware
const mockAuth = (req, res, next) => {
  req.user = { id: 'test-user-123' };
  next();
};

// Import the text extraction routes
const textExtractionRoutes = require('./src/routes/textExtraction.routes');

// Mount the routes
app.use('/api/extraction', mockAuth, textExtractionRoutes);

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Client-side integration test server running',
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🧪 Test server running on port ${PORT}`);
  console.log(`📝 Test endpoint: http://localhost:${PORT}/test`);
  console.log(`🔄 Text processing: http://localhost:${PORT}/api/extraction/process-text`);
});

// Test the text processing endpoint
const testTextProcessing = async () => {
  const testData = {
    text: `
      CALL SHEET - FASHION SHOOT
      
      DIRECTOR: John Smith
      Email: john@example.com
      Phone: (555) 123-4567
      
      PHOTOGRAPHER: Sarah Johnson
      Email: sarah@example.com
      Phone: (555) 987-6543
      
      MUA: Lisa Brown
      Email: lisa@example.com
      Phone: (555) 456-7890
      
      STYLIST: Mike Davis
      Email: mike@example.com
      Phone: (555) 321-0987
    `,
    fileName: 'test-call-sheet.pdf',
    fileType: 'application/pdf',
    extractionMethod: 'hybrid',
    rolePreferences: ['Director', 'Photographer', 'MUA', 'Stylist'],
    options: JSON.stringify({}),
    priority: 'normal'
  };

  try {
    console.log('\n🧪 Testing text processing endpoint...');
    
    const response = await fetch(`http://localhost:${PORT}/api/extraction/process-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify(testData)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Text processing test successful!');
      console.log(`📊 Contacts found: ${result.contacts?.length || 0}`);
      console.log(`⏱️ Processing time: ${result.metadata?.processingTime || 0}ms`);
      console.log(`🎯 Strategy used: ${result.metadata?.strategy || 'unknown'}`);
      
      if (result.contacts && result.contacts.length > 0) {
        console.log('\n📋 Sample contacts:');
        result.contacts.slice(0, 3).forEach((contact, index) => {
          console.log(`  ${index + 1}. ${contact.name} - ${contact.role} (${contact.email})`);
        });
      }
    } else {
      const error = await response.text();
      console.error('❌ Text processing test failed:', response.status, error);
    }
  } catch (error) {
    console.error('❌ Test request failed:', error.message);
  }
};

// Run test after a short delay to ensure server is ready
setTimeout(testTextProcessing, 2000);

module.exports = app;
