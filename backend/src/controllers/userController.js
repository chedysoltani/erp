const User = require('../models/User');
const jwt = require('jsonwebtoken');

class UserController {
  static async getAllUsers(req, res) {
    try {
      const users = await User.getAll();
      res.json({
        success: true,
        data: users,
        message: 'Utilisateurs récupérés avec succès'
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getUserById(req, res) {
    try {
      const { id } = req.params;
      const user = await User.getById(id);

      if (!user) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }

      res.json({ success: true, data: user, message: 'Utilisateur récupéré avec succès' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createUser(req, res) {
    try {
      const userData = req.body;

      if (!userData.nom || !userData.prenom || !userData.email || !userData.password || !userData.role) {
        return res.status(400).json({
          success: false,
          message: 'Les champs nom, prénom, email, password et role sont obligatoires'
        });
      }

      const validRoles = ['employee', 'manager', 'admin'];
      if (!validRoles.includes(userData.role)) {
        return res.status(400).json({ success: false, message: 'Rôle invalide' });
      }

      if (userData.password.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Le mot de passe doit contenir au moins 8 caractères'
        });
      }

      const userId = await User.create(userData);
      res.status(201).json({ success: true, data: { id: userId }, message: 'Utilisateur créé avec succès' });
    } catch (error) {
      if (error.message.includes('déjà utilisé')) {
        return res.status(409).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateUser(req, res) {
    try {
      const { id } = req.params;
      const userData = req.body;

      if (!userData.nom || !userData.prenom || !userData.email || !userData.role) {
        return res.status(400).json({
          success: false,
          message: 'Les champs nom, prénom, email et role sont obligatoires'
        });
      }

      const validRoles = ['employee', 'manager', 'admin'];
      if (!validRoles.includes(userData.role)) {
        return res.status(400).json({ success: false, message: 'Rôle invalide' });
      }

      const updated = await User.update(id, userData);

      if (!updated) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }

      res.json({ success: true, message: 'Utilisateur mis à jour avec succès' });
    } catch (error) {
      if (error.message.includes('déjà utilisé')) {
        return res.status(409).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async deleteUser(req, res) {
    try {
      const { id } = req.params;

      const user = await User.getById(id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }

      const deleted = await User.delete(id);

      if (!deleted) {
        return res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
      }

      res.json({ success: true, message: 'Utilisateur supprimé avec succès' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email et mot de passe sont requis' });
      }

      const user = await User.getByEmail(email);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
      }

      const isValidPassword = await User.validatePassword(password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
      }

      // Silently upgrade plain-text passwords to bcrypt on first login
      await User.upgradePasswordIfNeeded(user.id, password, user.password);

      const userRole = user.role || 'employee';

      const token = jwt.sign(
        { id: user.id, email: user.email, role: userRole },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        message: 'Connexion réussie',
        token: token,
        data: {
          id: user.id,
          nom: user.nom,
          prenom: user.prenom,
          email: user.email,
          telephone: user.telephone,
          role: userRole,
          date_creation: user.date_creation
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = UserController;
