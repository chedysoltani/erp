const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ success: false, message: 'Accès refusé. Aucun jeton fourni.' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, message: 'Configuration serveur invalide.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Jeton invalide ou expiré.' });
  }
};

const isManager = (req, res, next) => {
  if (req.user.role !== 'manager' && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Accès refusé. Rôle Manager requis.' });
  }
  next();
};

const isEmployee = (req, res, next) => {
  if (!['employee', 'manager', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Accès refusé. Rôle Employé requis.' });
  }
  next();
};

module.exports = { auth, isManager, isEmployee };
