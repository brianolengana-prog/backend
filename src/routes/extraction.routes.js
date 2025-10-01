const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const extractionService = require('../services/extraction.service');

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
  try {
    const result = await extractionService.extractText(filePath);
    res.json({ success: true, result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  } finally {
    fs.promises.unlink(filePath).catch(() => {});
  }
});

module.exports = router;


