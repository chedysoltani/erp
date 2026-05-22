const db = require('../config/database');
const bcrypt = require('bcryptjs');
const saltRounds = 10;

class User {
  static async getAll() {
    try {
      const query = 'SELECT id, nom, prenom, email, telephone, role, date_creation, actif FROM users WHERE actif = 1 ORDER BY date_creation DESC';
      return await db.query(query);
    } catch (error) {
      throw new Error('Erreur lors de la récupération des utilisateurs: ' + error.message);
    }
  }

  static async getById(id) {
    try {
      const query = 'SELECT id, nom, prenom, email, telephone, role, date_creation, actif FROM users WHERE id = ? AND actif = 1';
      const users = await db.query(query, [id]);
      return users[0] || null;
    } catch (error) {
      throw new Error('Erreur lors de la récupération de l\'utilisateur: ' + error.message);
    }
  }

  static async create(userData) {
    try {
      const { nom, prenom, email, password, telephone, role } = userData;
      
      // Vérifier si l'email existe déjà
      const existingUser = await this.getByEmail(email);
      if (existingUser) {
        throw new Error('Cet email est déjà utilisé');
      }
      
      // Hasher le mot de passe
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      const query = 'INSERT INTO users (nom, prenom, email, password, telephone, role) VALUES (?, ?, ?, ?, ?, ?)';
      const result = await db.query(query, [nom, prenom, email, hashedPassword, telephone, role || 'employee']);
      return result.insertId;
    } catch (error) {
      throw new Error('Erreur lors de la création de l\'utilisateur: ' + error.message);
    }
  }

  static async update(id, userData) {
    try {
      const { nom, prenom, email, telephone, role } = userData;
      
      // Vérifier si l'email existe déjà pour un autre utilisateur
      const existingUser = await this.getByEmail(email);
      if (existingUser && existingUser.id !== id) {
        throw new Error('Cet email est déjà utilisé');
      }
      
      const query = 'UPDATE users SET nom = ?, prenom = ?, email = ?, telephone = ?, role = ? WHERE id = ?';
      const result = await db.query(query, [nom, prenom, email, telephone, role, id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error('Erreur lors de la mise à jour de l\'utilisateur: ' + error.message);
    }
  }

  static async delete(id) {
    try {
      const query = 'UPDATE users SET actif = 0 WHERE id = ?';
      const result = await db.query(query, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error('Erreur lors de la suppression de l\'utilisateur: ' + error.message);
    }
  }

  static async getByEmail(email) {
    try {
      const query = 'SELECT id, nom, prenom, email, telephone, role, date_creation, actif, password FROM users WHERE email = ? AND actif = 1';
      const users = await db.query(query, [email]);
      return users[0] || null;
    } catch (error) {
      throw new Error('Erreur lors de la recherche par email: ' + error.message);
    }
  }

  static async validatePassword(password, storedPassword) {
    try {
      // Bcrypt hash starts with $2b$ or $2a$
      if (storedPassword && (storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2a$'))) {
        return await bcrypt.compare(password, storedPassword);
      }
      // Legacy plain-text password — direct compare
      return password === storedPassword;
    } catch (error) {
      throw new Error('Erreur lors de la validation du mot de passe: ' + error.message);
    }
  }

  // Auto-upgrade plain-text password to bcrypt after successful login
  static async upgradePasswordIfNeeded(userId, password, storedPassword) {
    if (storedPassword && !storedPassword.startsWith('$2b$') && !storedPassword.startsWith('$2a$')) {
      const hash = await bcrypt.hash(password, saltRounds);
      await db.query('UPDATE users SET password = ? WHERE id = ?', [hash, userId]);
    }
  }
}

module.exports = User;
