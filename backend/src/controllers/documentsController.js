const Document = require('../models/Document');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// ---------------------------------------------------------------
// NOTE : JWT/auth temporairement désactivé.
// req.user n'est plus disponible — on utilise uploaded_by = 1 (manager par défaut)
// ou on le reçoit depuis le body si besoin.
// ---------------------------------------------------------------

// Configuration de Multer pour le stockage des fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/documents');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg'
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format de fichier non supporté. (PDF, DOC, DOCX, PNG, JPG uniquement)'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
}).single('file');

class DocumentsController {
  static async uploadDocument(req, res) {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Aucun fichier téléchargé.' });
      }

      try {
        const { title, description, employeeId, uploadedBy } = req.body;

        // Validation du titre
        if (!title) {
          return res.status(400).json({ success: false, message: 'Le titre est obligatoire.' });
        }

        // Construire le chemin relatif du fichier (url-friendly)
        const relativePath = 'uploads/documents/' + req.file.filename;

        const docData = {
          title,
          description: description || '',
          file_name: req.file.originalname,
          file_path: relativePath,
          file_type: req.file.mimetype,
          file_size: (req.file.size / 1024 / 1024).toFixed(2), // MB
          employee_id: employeeId ? parseInt(employeeId, 10) : null,
          // uploaded_by : on prend la valeur du body si fournie, sinon 1 (manager par défaut)
          uploaded_by: uploadedBy ? parseInt(uploadedBy, 10) : 1
        };

        const docId = await Document.create(docData);
        const newDoc = await Document.getById(docId);

        res.status(201).json({
          success: true,
          message: 'Document téléchargé et enregistré avec succès.',
          data: newDoc
        });
      } catch (error) {
        console.error('Erreur uploadDocument:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de l\'enregistrement du document.' });
      }
    });
  }

  static async getAllDocuments(req, res) {
    try {
      const documents = await Document.getAll();
      res.json({
        success: true,
        data: documents
      });
    } catch (error) {
      console.error('Erreur getAllDocuments:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la récupération des documents.' });
    }
  }

  // Route /my — utilisée si l'employé passe son id en query param
  static async getMyDocuments(req, res) {
    try {
      const employeeId = req.query.employeeId;
      if (!employeeId) {
        return res.status(400).json({ success: false, message: 'employeeId requis en query param.' });
      }
      const documents = await Document.getByEmployeeId(parseInt(employeeId, 10));
      res.json({
        success: true,
        data: documents
      });
    } catch (error) {
      console.error('Erreur getMyDocuments:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la récupération de vos documents.' });
    }
  }

  // Route /employee/:employeeId — récupérer les docs d'un employé spécifique
  static async getDocumentsByEmployee(req, res) {
    try {
      const employeeId = parseInt(req.params.employeeId, 10);
      const documents = await Document.getByEmployeeId(employeeId);
      res.json({
        success: true,
        data: documents
      });
    } catch (error) {
      console.error('Erreur getDocumentsByEmployee:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la récupération des documents.' });
    }
  }

  static async updateDocument(req, res) {
    try {
      const { id } = req.params;
      const { title, description, employeeId } = req.body;

      const updated = await Document.update(id, { title, description, employee_id: employeeId });

      if (!updated) {
        return res.status(404).json({ success: false, message: 'Document non trouvé.' });
      }

      res.json({
        success: true,
        message: 'Document mis à jour avec succès.'
      });
    } catch (error) {
      console.error('Erreur updateDocument:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour du document.' });
    }
  }

  static async deleteDocument(req, res) {
    try {
      const { id } = req.params;
      const doc = await Document.getById(id);

      if (!doc) {
        return res.status(404).json({ success: false, message: 'Document non trouvé.' });
      }

      // Supprimer le fichier physique
      const absolutePath = path.join(__dirname, '../../', doc.file_path);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }

      // Supprimer l'entrée en base
      await Document.delete(id);

      res.json({
        success: true,
        message: 'Document supprimé avec succès.'
      });
    } catch (error) {
      console.error('Erreur deleteDocument:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la suppression du document.' });
    }
  }
}

module.exports = DocumentsController;
