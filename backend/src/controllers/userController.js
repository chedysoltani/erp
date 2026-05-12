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
      console.error('Erreur getAllUsers:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getUserById(req, res) {
    try {
      const { id } = req.params;
      const user = await User.getById(id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      res.json({
        success: true,
        data: user,
        message: 'Utilisateur récupéré avec succès'
      });
    } catch (error) {
      console.error('Erreur getUserById:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async createUser(req, res) {
    try {
      const userData = req.body;
      
      // Validation basique
      if (!userData.nom || !userData.prenom || !userData.email || !userData.password || !userData.role) {
        return res.status(400).json({
          success: false,
          message: 'Les champs nom, prénom, email, password et role sont obligatoires'
        });
      }

      const userId = await User.create(userData);
      
      res.status(201).json({
        success: true,
        data: { id: userId },
        message: 'Utilisateur créé avec succès'
      });
    } catch (error) {
      console.error('Erreur createUser:', error);
      
      // Gérer les erreurs spécifiques
      if (error.message.includes('déjà utilisé')) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async updateUser(req, res) {
    try {
      const { id } = req.params;
      const userData = req.body;
      
      // Validation basique
      if (!userData.nom || !userData.prenom || !userData.email || !userData.role) {
        return res.status(400).json({
          success: false,
          message: 'Les champs nom, prénom, email et role sont obligatoires'
        });
      }

      const updated = await User.update(id, userData);
      
      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      res.json({
        success: true,
        message: 'Utilisateur mis à jour avec succès'
      });
    } catch (error) {
      console.error('Erreur updateUser:', error);
      
      // Gérer les erreurs spécifiques
      if (error.message.includes('déjà utilisé')) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async deleteUser(req, res) {
    try {
      const { id } = req.params;
      
      // Vérifier si l'utilisateur existe
      const user = await User.getById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      const deleted = await User.delete(id);
      
      if (!deleted) {
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la suppression de l\'utilisateur'
        });
      }

      res.json({
        success: true,
        message: 'Utilisateur supprimé avec succès'
      });
    } catch (error) {
      console.error('Erreur deleteUser:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;
      
      // Validation basique
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email et mot de passe sont requis'
        });
      }

      // Récupérer l'utilisateur par email
      const user = await User.getByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Email ou mot de passe incorrect'
        });
      }

      // Pour les employés, accepter temporairement n'importe quel mot de passe
      let isValidPassword = false;
      if (user.role === 'employee' && email.endsWith('@sit.com.tn')) {
        // Accepter n'importe quel mot de passe pour les employés SIT
        isValidPassword = true;
        console.log('Login employé SIT accepté pour:', email);
      } else {
        // Validation normale pour les autres
        isValidPassword = await User.validatePassword(password, user.password);
      }
      
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Email ou mot de passe incorrect'
        });
      }

      // S'assurer que le rôle est bien défini
      let userRole = user.role || 'employee';
      
      // Forcer le rôle manager pour l'email spécifique
      if (user.email === 'sofienne.manager@sit.com.tn') {
        userRole = 'manager';
      }
      
      console.log('User role:', userRole, 'for user:', user.email, 'original role:', user.role);

      // Générer un token JWT
      const token = jwt.sign(
        { id: user.id, email: user.email, role: userRole },
        process.env.JWT_SECRET || 'sit_erp_secret_key_2024',
        { expiresIn: '24h' }
      );

      // Retourner les informations utilisateur (sans le mot de passe)
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
      console.error('Erreur login:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = UserController;
