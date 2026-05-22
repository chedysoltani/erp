const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const IAController = require('../controllers/iaController');
const { auth, isManager } = require('../middleware/auth');

const tempDir = path.join(__dirname, '../../uploads/temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const upload = multer({
  dest: tempDir,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers PDF sont acceptés.'), false);
    }
  }
});

router.post('/simulate-pdf', auth, isManager, upload.single('file'), IAController.simulateProjectFromPdf);
router.post('/confirm-project', auth, isManager, IAController.confirmProject);
router.post('/save-planning', auth, isManager, IAController.savePlanning);
router.get('/plannings', auth, isManager, IAController.getPlannings);

module.exports = router;
