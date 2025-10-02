const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const extractionService = require('../services/extraction.service');
const usageService = require('../services/usage.service');

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(process.cwd(), 'backend-clean', 'uploads')),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  }),
  limits: { fileSize: 15 * 1024 * 1024 }
});

router.post('/extract', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'File required' });
  
  const filePath = req.file.path;
  const userId = req.user.userId;
  
  try {
    // Check if user can upload
    const canUpload = await usageService.canUserUpload(userId);
    if (!canUpload) {
      return res.status(403).json({ 
        success: false, 
        error: 'Upload limit reached for current plan' 
      });
    }

    // Extract text from file
    const result = await extractionService.extractText(filePath);
    
    // Record the upload and count contacts
    const contactsCount = result.contacts?.length || 0;
    await usageService.recordUpload(userId, contactsCount);
    
    res.json({ success: true, result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  } finally {
    fs.promises.unlink(filePath).catch(() => {});
  }
});

module.exports = router;


