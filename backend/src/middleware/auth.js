const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Accès refusé. Aucun jeton fourni.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Jeton invalide.'
    });
  }
};

const isManager = (req, res, next) => {
  if (req.user.role !== 'manager' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Accès refusé. Rôle Manager requis.'
    });
  }
  next();
};

const isEmployee = (req, res, next) => {
  if (req.user.role !== 'employee' && req.user.role !== 'manager' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Accès refusé. Rôle Employé requis.'
    });
  }
  next();
};

module.exports = { auth, isManager, isEmployee };
