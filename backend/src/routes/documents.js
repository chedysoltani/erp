const express = require('express');
const router = express.Router();
const DocumentsController = require('../controllers/documentsController');

// ---------------------------------------------------------------
// NOTE : JWT/auth temporairement désactivé pour cette phase de dev.
// Les guards auth/isManager/isEmployee sont retirés.
// À réactiver quand le système JWT sera remis en place.
// ---------------------------------------------------------------

// Routes Manager
router.post('/',     DocumentsController.uploadDocument);
router.get('/',      DocumentsController.getAllDocuments);
router.put('/:id',   DocumentsController.updateDocument);
router.delete('/:id',DocumentsController.deleteDocument);

// Routes Employé
router.get('/employee/:employeeId', DocumentsController.getDocumentsByEmployee);

// Route legacy /my (si utilisée côté employé avec query param)
router.get('/my', DocumentsController.getMyDocuments);

module.exports = router;
