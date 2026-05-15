const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const IAController = require('../controllers/iaController');

// Configuration temporaire de Multer pour les uploads PDF
const upload = multer({
  dest: path.join(__dirname, '../../uploads/temp/'),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers PDF sont acceptés.'), false);
    }
  }
});

// Créer le dossier temp s'il n'existe pas
const tempDir = path.join(__dirname, '../../uploads/temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

router.post('/simulate-pdf', upload.single('file'), IAController.simulateProjectFromPdf);
router.post('/confirm-project', IAController.confirmProject);

module.exports = router;
