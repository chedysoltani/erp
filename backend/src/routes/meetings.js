const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Middleware pour vérifier l'authentification
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token d\'authentification manquant' });
  }

  // TODO: Implémenter la vérification du token JWT
  // Pour l'instant, on simule une authentification réussie
  req.user = { id: 1 }; // Simuler l'utilisateur connecté
  next();
};

// Créer une nouvelle réunion
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      date_time,
      duration,
      location,
      type,
      status = 'upcoming',
      participants = 1,
      agenda = [],
      notes = '',
      meeting_link = '',
      selectedEmployees = []
    } = req.body;

    // Validation des champs obligatoires
    if (!title || !date_time || !location || !type) {
      return res.status(400).json({ 
        error: 'Champs obligatoires manquants',
        required: ['title', 'date_time', 'location', 'type']
      });
    }

    // Validation des valeurs enum
    const validTypes = ['team', 'client', 'technical', 'review'];
    const validStatuses = ['upcoming', 'scheduled', 'completed', 'cancelled'];

    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        error: 'Type de réunion invalide',
        validTypes
      });
    }

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Statut de réunion invalide',
        validStatuses
      });
    }

    const connection = await db.getConnection();
    
    // Validation et conversion de la date
    let formattedDateTime = date_time;
    if (date_time.includes('T')) {
      // Convertir ISO datetime en MySQL datetime format
      const dateObj = new Date(date_time);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({ 
          error: 'Format de date invalide',
          received: date_time,
          expected: 'YYYY-MM-DD HH:MM:SS ou ISO datetime'
        });
      }
      formattedDateTime = dateObj.toISOString().slice(0, 19).replace('T', ' ');
    }

    const query = `
      INSERT INTO meetings (
        title, description, date_time, duration, location, type, 
        status, participants, creator_id, agenda, notes, meeting_link
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    // Démarrer une transaction
    await connection.beginTransaction();

    const values = [
      title,
      description || title,
      formattedDateTime,
      duration || '1h',
      location,
      type,
      status,
      Array.isArray(participants) ? participants.length : (participants || 1),
      req.user.id,
      JSON.stringify(agenda),
      notes,
      meeting_link || ''
    ];

    console.log('Valeurs pour l\'insertion:', values);
    console.log('Nombre de valeurs:', values.length);
    console.log('Requête:', query);

    const [result] = await connection.execute(query, values);

    const meetingId = result.insertId;

    // Insérer les employés assignés à la réunion
    if (selectedEmployees && selectedEmployees.length > 0) {
      console.log('Employés sélectionnés:', selectedEmployees);
      
      // Vérifier d'abord si les employés existent
      // NOTE: La vérification est commentée pour éviter les conflits de transaction
      // Les employés sont supposés exister grâce à la contrainte de clé étrangère
      
      const employeeQuery = `
        INSERT INTO meeting_employees (meeting_id, employee_id, status)
        VALUES (?, ?, 'pending')
      `;

      for (const employeeId of selectedEmployees) {
        console.log('Insertion employé ID:', employeeId, 'pour réunion ID:', meetingId);
        await connection.execute(employeeQuery, [meetingId, employeeId]);
      }
    }

    // Récupérer la réunion créée avec ses employés assignés
    const [meetingRows] = await connection.execute(
      'SELECT * FROM meetings WHERE id = ?',
      [meetingId]
    );

    const [employeeRows] = await connection.execute(
      `SELECT u.id, u.nom, u.prenom, u.email, me.status as meeting_status
       FROM meeting_employees me
       JOIN users u ON me.employee_id = u.id
       WHERE me.meeting_id = ?`,
      [meetingId]
    );

    // Valider la transaction
    await connection.commit();
    connection.release();

    const meeting = meetingRows[0];
    meeting.agenda = JSON.parse(meeting.agenda || '[]');
    meeting.assignedEmployees = employeeRows;

    res.status(201).json({
      success: true,
      message: 'Réunion créée avec succès',
      data: meeting
    });

  } catch (error) {
    console.error('Erreur lors de la création de la réunion:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la création de la réunion',
      details: error.message
    });
  }
});

// Récupérer toutes les réunions d'un manager
router.get('/manager/:managerId', authenticateToken, async (req, res) => {
  try {
    const { managerId } = req.params;
    
    const connection = await db.getConnection();
    
    const [rows] = await connection.execute(
      'SELECT * FROM meetings WHERE creator_id = ? ORDER BY date_time ASC',
      [managerId]
    );

    connection.release();

    // Parser les champs JSON
    const meetings = rows.map(meeting => ({
      ...meeting,
      agenda: JSON.parse(meeting.agenda || '[]')
    }));

    res.json({
      success: true,
      data: meetings,
      count: meetings.length
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des réunions:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la récupération des réunions',
      details: error.message
    });
  }
});

// Récupérer les réunions à venir d'un manager
router.get('/upcoming/manager/:managerId', authenticateToken, async (req, res) => {
  try {
    const { managerId } = req.params;
    
    const connection = await db.getConnection();
    
    const [rows] = await connection.execute(
      `SELECT * FROM meetings 
       WHERE creator_id = ? AND status IN ('upcoming', 'scheduled') 
       AND date_time >= NOW() 
       ORDER BY date_time ASC`,
      [managerId]
    );

    connection.release();

    // Parser les champs JSON
    const meetings = rows.map(meeting => ({
      ...meeting,
      agenda: JSON.parse(meeting.agenda || '[]')
    }));

    res.json({
      success: true,
      data: meetings,
      count: meetings.length
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des réunions à venir:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la récupération des réunions à venir',
      details: error.message
    });
  }
});

// Mettre à jour une réunion
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      date_time,
      duration,
      location,
      type,
      status,
      participants,
      agenda,
      notes,
      meeting_link
    } = req.body;

    // Vérifier que la réunion existe et appartient à l'utilisateur
    const connection = await db.getConnection();
    
    const [existingRows] = await connection.execute(
      'SELECT * FROM meetings WHERE id = ? AND creator_id = ?',
      [id, req.user.id]
    );

    if (existingRows.length === 0) {
      connection.release();
      return res.status(404).json({ 
        error: 'Réunion non trouvée ou accès non autorisé' 
      });
    }

    // Validation des valeurs enum si fournies
    if (type) {
      const validTypes = ['team', 'client', 'technical', 'review'];
      if (!validTypes.includes(type)) {
        connection.release();
        return res.status(400).json({ 
          error: 'Type de réunion invalide',
          validTypes
        });
      }
    }

    if (status) {
      const validStatuses = ['upcoming', 'scheduled', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        connection.release();
        return res.status(400).json({ 
          error: 'Statut de réunion invalide',
          validStatuses
        });
      }
    }

    // Construire la requête de mise à jour dynamique
    const updateFields = [];
    const updateValues = [];

    if (title !== undefined) {
      updateFields.push('title = ?');
      updateValues.push(title);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (date_time !== undefined) {
      updateFields.push('date_time = ?');
      // Convertir ISO datetime en MySQL datetime format
      let formattedDateTime = date_time;
      if (date_time.includes('T')) {
        const dateObj = new Date(date_time);
        if (!isNaN(dateObj.getTime())) {
          formattedDateTime = dateObj.toISOString().slice(0, 19).replace('T', ' ');
        }
      }
      updateValues.push(formattedDateTime);
    }
    if (duration !== undefined) {
      updateFields.push('duration = ?');
      updateValues.push(duration);
    }
    if (location !== undefined) {
      updateFields.push('location = ?');
      updateValues.push(location);
    }
    if (type !== undefined) {
      updateFields.push('type = ?');
      updateValues.push(type);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (participants !== undefined) {
      updateFields.push('participants = ?');
      updateValues.push(participants);
    }
    if (agenda !== undefined) {
      updateFields.push('agenda = ?');
      updateValues.push(JSON.stringify(agenda));
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(notes);
    }
    if (meeting_link !== undefined) {
      updateFields.push('meeting_link = ?');
      updateValues.push(meeting_link);
    }

    if (updateFields.length === 0) {
      connection.release();
      return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    }

    updateValues.push(id);

    const updateQuery = `
      UPDATE meetings 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND creator_id = ?
    `;
    updateValues.push(req.user.id);

    await connection.execute(updateQuery, updateValues);

    // Récupérer la réunion mise à jour
    const [updatedRows] = await connection.execute(
      'SELECT * FROM meetings WHERE id = ?',
      [id]
    );

    connection.release();

    const updatedMeeting = updatedRows[0];
    updatedMeeting.agenda = JSON.parse(updatedMeeting.agenda || '[]');

    res.json({
      success: true,
      message: 'Réunion mise à jour avec succès',
      data: updatedMeeting
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour de la réunion:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la mise à jour de la réunion',
      details: error.message
    });
  }
});

// Supprimer une réunion
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await db.getConnection();
    
    // Vérifier que la réunion existe et appartient à l'utilisateur
    const [existingRows] = await connection.execute(
      'SELECT * FROM meetings WHERE id = ? AND creator_id = ?',
      [id, req.user.id]
    );

    if (existingRows.length === 0) {
      connection.release();
      return res.status(404).json({ 
        error: 'Réunion non trouvée ou accès non autorisé' 
      });
    }

    // Supprimer la réunion
    await connection.execute(
      'DELETE FROM meetings WHERE id = ? AND creator_id = ?',
      [id, req.user.id]
    );

    connection.release();

    res.json({
      success: true,
      message: 'Réunion supprimée avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression de la réunion:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la suppression de la réunion',
      details: error.message
    });
  }
});

// Récupérer une réunion spécifique
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await db.getConnection();
    
    const [rows] = await connection.execute(
      'SELECT * FROM meetings WHERE id = ? AND creator_id = ?',
      [id, req.user.id]
    );

    connection.release();

    if (rows.length === 0) {
      return res.status(404).json({ 
        error: 'Réunion non trouvée' 
      });
    }

    const meeting = rows[0];
    meeting.agenda = JSON.parse(meeting.agenda || '[]');

    res.json({
      success: true,
      data: meeting
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de la réunion:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la récupération de la réunion',
      details: error.message
    });
  }
});

// Récupérer les réunions assignées à un employé
router.get('/employee/:employeeId', authenticateToken, async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    const connection = await db.getConnection();
    
    const [rows] = await connection.execute(
      `SELECT m.*, me.status as meeting_status, me.response_time
       FROM meetings m
       JOIN meeting_employees me ON m.id = me.meeting_id
       WHERE me.employee_id = ?
       ORDER BY m.date_time ASC`,
      [employeeId]
    );

    connection.release();

    // Parser les champs JSON
    const meetings = rows.map(meeting => ({
      ...meeting,
      agenda: JSON.parse(meeting.agenda || '[]')
    }));

    res.json({
      success: true,
      data: meetings
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des réunions employé:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la récupération des réunions',
      details: error.message
    });
  }
});

// Mettre à jour le statut de participation d'un employé
router.put('/:meetingId/employee/:employeeId/status', authenticateToken, async (req, res) => {
  try {
    const { meetingId, employeeId } = req.params;
    const { status, notes } = req.body;
    
    const validStatuses = ['pending', 'accepted', 'declined', 'tentative'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Statut invalide',
        validStatuses
      });
    }

    const connection = await db.getConnection();
    
    const [result] = await connection.execute(
      `UPDATE meeting_employees 
       SET status = ?, response_time = CURRENT_TIMESTAMP, notes = ?
       WHERE meeting_id = ? AND employee_id = ?`,
      [status, notes || null, meetingId, employeeId]
    );

    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        error: 'Assignation non trouvée' 
      });
    }

    res.json({
      success: true,
      message: 'Statut de participation mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la mise à jour du statut',
      details: error.message
    });
  }
});

module.exports = router;
