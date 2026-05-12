const db = require('../config/database');

class Document {
  static async create(docData) {
    const { title, description, file_name, file_path, file_type, file_size, employee_id, uploaded_by } = docData;
    const query = `
      INSERT INTO documents 
      (title, description, file_name, file_path, file_type, file_size, employee_id, uploaded_by) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await db.query(query, [
      title, 
      description, 
      file_name, 
      file_path, 
      file_type, 
      file_size, 
      employee_id, 
      uploaded_by
    ]);
    return result.insertId;
  }

  static async getAll() {
    const query = `
      SELECT d.*, CONCAT(u.prenom, ' ', u.nom) as employee_name 
      FROM documents d 
      LEFT JOIN users u ON d.employee_id = u.id 
      ORDER BY d.created_at DESC
    `;
    return await db.query(query);
  }

  static async getById(id) {
    const query = 'SELECT * FROM documents WHERE id = ?';
    const results = await db.query(query, [id]);
    return results[0];
  }

  static async getByEmployeeId(employeeId) {
    const query = 'SELECT * FROM documents WHERE employee_id = ? ORDER BY created_at DESC';
    return await db.query(query, [employeeId]);
  }

  static async update(id, docData) {
    const { title, description, employee_id } = docData;
    const query = 'UPDATE documents SET title = ?, description = ?, employee_id = ? WHERE id = ?';
    const result = await db.query(query, [title, description, employee_id, id]);
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const query = 'DELETE FROM documents WHERE id = ?';
    const result = await db.query(query, [id]);
    return result.affectedRows > 0;
  }
}

module.exports = Document;
