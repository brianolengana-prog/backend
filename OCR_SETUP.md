# OCR Setup for Scanned PDFs

This document explains how to set up OCR (Optical Character Recognition) for processing scanned PDFs.

## Overview

The system now automatically detects scanned PDFs and uses OCR to extract text when regular PDF text extraction yields insufficient results.

## Features

### Automatic Detection
- **Text Density Analysis**: Detects when very little text is extracted (< 100 characters)
- **Pattern Analysis**: Identifies OCR artifacts and scanned document characteristics
- **Smart Fallback**: Automatically switches to OCR when needed

### OCR Processing
- **Tesseract.js Integration**: Uses Google's Tesseract OCR engine
- **Multi-language Support**: Configured for English ('eng') by default
- **Progress Logging**: Detailed logging of OCR processing steps
- **Error Handling**: Graceful fallback when OCR fails

## Dependencies

The following libraries are required for OCR functionality:

```bash
npm install tesseract.js
```

Optional libraries for enhanced PDF processing:
```bash
npm install pdf2pic sharp
```

## How It Works

### 1. PDF Text Extraction
```javascript
// Regular PDF processing first
const text = await extractTextFromPDF(buffer);
```

### 2. Scanned PDF Detection
```javascript
// Automatic detection based on text characteristics
const isScanned = textLength < 100 || isLikelyScannedPDF(text);
```

### 3. OCR Fallback
```javascript
// If detected as scanned, attempt OCR
if (isScanned) {
  const ocrText = await extractTextFromScannedPDF(buffer);
  if (ocrText.length > text.length) {
    return ocrText; // Use OCR results
  }
}
```

## Detection Criteria

A PDF is considered scanned if it meets any of these criteria:

- **Text Length**: Less than 100 characters extracted
- **Line Length**: Average line length less than 20 characters
- **Short Lines**: More than 50% of lines are shorter than 10 characters
- **Special Characters**: More than 30% non-alphanumeric characters

## Configuration

### Environment Variables
```bash
# Optional: Disable AI for XLSX files
AI_ENABLED_FOR_XLSX=false

# Optional: Configure AI settings
AI_MAX_CHUNKS=20
AI_CHUNK_SIZE=4000
```

### OCR Settings
```javascript
// Tesseract configuration
const { data: { text } } = await tesseract.recognize(buffer, 'eng', {
  logger: m => console.log(`OCR Progress: ${m}`)
});
```

## Usage Examples

### Processing a Scanned PDF
```javascript
const extractionService = require('./src/services/extraction.service');

// This will automatically detect and use OCR if needed
const text = await extractionService.extractTextFromDocument(pdfBuffer, 'application/pdf');
```

### Manual OCR Processing
```javascript
// Force OCR processing
const ocrText = await extractionService.extractTextFromScannedPDF(pdfBuffer);
```

## Error Handling

### Common Issues
1. **Tesseract Not Available**: Install `tesseract.js` package
2. **Low Quality Images**: OCR may not work well with very low resolution PDFs
3. **Complex Layouts**: Tables and complex formatting may not be preserved

### Fallback Strategies
1. **Regular PDF Extraction**: Always attempted first
2. **OCR Processing**: Used when regular extraction fails
3. **Error Messages**: Clear guidance when both methods fail

## Performance Considerations

### Processing Time
- **Regular PDFs**: ~1-2 seconds
- **Scanned PDFs**: ~5-15 seconds (depending on size and complexity)
- **Large PDFs**: May take longer due to OCR processing

### Memory Usage
- OCR processing uses more memory than regular text extraction
- Consider file size limits for production use

## Troubleshooting

### OCR Not Working
1. Check if `tesseract.js` is installed
2. Verify the PDF is actually scanned (not just low-quality text)
3. Check console logs for detailed error messages

### Poor OCR Results
1. Ensure PDF has good image quality
2. Check if text is rotated or skewed
3. Consider preprocessing the PDF for better results

## Future Enhancements

### Planned Features
- **Multi-language OCR**: Support for different languages
- **Image Preprocessing**: Enhance images before OCR
- **Cloud OCR**: Integration with cloud OCR services
- **Batch Processing**: Process multiple scanned PDFs

### Alternative OCR Engines
- **Google Cloud Vision API**: For high-volume processing
- **AWS Textract**: For document-specific OCR
- **Azure Computer Vision**: For Microsoft ecosystem integration

## Support

For issues with OCR processing:
1. Check the console logs for detailed error messages
2. Verify all dependencies are installed correctly
3. Test with a known good scanned PDF
4. Consider the PDF quality and resolution
