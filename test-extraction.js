const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');

// Import our services
const queueService = require('./src/services/queue.service');
const jobProcessor = require('./src/services/jobProcessor.service');
const optimizedHybridExtractionService = require('./src/services/optimizedHybridExtraction.service');

const prisma = new PrismaClient();

async function testExtractionSystem() {
  console.log('🧪 Starting extraction system test...\n');

  try {
    // Test 1: Check if we can create a test file
    console.log('📁 Test 1: Creating test file...');
    const testFilePath = path.join(__dirname, 'test-callsheet.pdf');
    
    // Create a simple test PDF content (this is just a placeholder)
    const testContent = 'Test call sheet content for extraction testing';
    fs.writeFileSync(testFilePath, testContent);
    console.log('✅ Test file created:', testFilePath);

    // Test 2: Test direct extraction (bypassing queue)
    console.log('\n🔍 Test 2: Testing direct extraction...');
    const fileBuffer = fs.readFileSync(testFilePath);
    
    const testUserId = uuidv4();
    const extractionResult = await optimizedHybridExtractionService.extractContacts(
      fileBuffer,
      'application/pdf',
      'test-callsheet.pdf',
      {
        userId: testUserId,
        rolePreferences: ['MUA', 'Stylist', 'Photographer']
      }
    );
    
    console.log('📊 Extraction result:', {
      success: extractionResult.success,
      contactsFound: extractionResult.contacts?.length || 0,
      processingTime: extractionResult.processingTime || 'N/A'
    });

    // Test 3: Test queue service
    console.log('\n🔄 Test 3: Testing queue service...');
    const jobData = {
      userId: testUserId,
      fileName: 'test-callsheet.pdf',
      fileType: 'pdf',
      fileSize: fileBuffer.length,
      extractionMethod: 'hybrid',
      priority: 'normal',
      options: {},
      fileBuffer: fileBuffer,
      metadata: {
        source: 'test',
        userAgent: 'test-script',
        ipAddress: '127.0.0.1'
      }
    };

    const queueResult = await queueService.addExtractionJob(jobData);
    console.log('📊 Queue result:', {
      success: queueResult.success,
      jobId: queueResult.jobId,
      fileId: queueResult.fileId
    });

    // Test 4: Test job processor directly
    console.log('\n⚙️ Test 4: Testing job processor...');
    const mockJob = {
      id: 'test-job-id',
      data: {
        userId: testUserId,
        fileId: 'test-file-id',
        fileName: 'test-callsheet.pdf',
        fileType: 'pdf',
        fileSize: fileBuffer.length,
        extractionMethod: 'hybrid',
        options: {},
        metadata: {}
      },
      opts: {
        priority: 'normal'
      }
    };

    // Mock the file reading for job processor
    const originalReadFile = fs.readFile;
    fs.readFile = (filePath, callback) => {
      if (filePath.includes('test-file-id')) {
        callback(null, fileBuffer);
      } else {
        originalReadFile(filePath, callback);
      }
    };

    const processorResult = await jobProcessor.processExtractionJob(mockJob);
    console.log('📊 Processor result:', {
      success: processorResult.success,
      contactsFound: processorResult.contacts?.length || 0
    });

    // Restore original readFile
    fs.readFile = originalReadFile;

    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    // Cleanup
    try {
      const testFilePath = path.join(__dirname, 'test-callsheet.pdf');
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
        console.log('🧹 Cleaned up test file');
      }
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup warning:', cleanupError.message);
    }
    
    await prisma.$disconnect();
  }
}

// Run the test
testExtractionSystem().catch(console.error);
