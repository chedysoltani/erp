const express = require('express');
const router = express.Router();
const db = require('../config/database');

const ASSIGNMENT_STATUSES = new Set(['pending', 'in_progress', 'completed']);

async function notifyTaskAssignment(conn, taskId, employeeId, taskTitle) {
  try {
    await conn.execute(
      `INSERT INTO task_notifications (task_id, employee_id, type, message, is_read)
       VALUES (?, ?, 'assigned', ?, FALSE)`,
      [taskId, employeeId, `Vous avez été assigné à la tâche : ${taskTitle || 'Tâche'}`]
    );
  } catch (e) {
    console.warn('task_notifications insert failed:', e.message);
  }
}

async function insertAssignmentsForNewTask(taskId, employeeIds, taskTitle) {
  const unique = [...new Set(employeeIds.map(Number).filter((n) => !Number.isNaN(n) && n > 0))];
  if (unique.length === 0) return;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const empId of unique) {
      await conn.execute(
        'INSERT INTO task_assignments (task_id, employee_id, status) VALUES (?, ?, ?)',
        [taskId, empId, 'pending']
      );
      await notifyTaskAssignment(conn, taskId, empId, taskTitle);
    }
    await conn.execute(
      'UPDATE tasks SET assignee_id = ?, has_multiple_assignees = ? WHERE id = ?',
      [unique[0], unique.length > 1, taskId]
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function syncTaskAssignmentsForTask(taskId, assignmentsBody, taskTitle) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [oldRows] = await conn.execute(
      'SELECT employee_id FROM task_assignments WHERE task_id = ?',
      [taskId]
    );
    const oldSet = new Set(oldRows.map((r) => r.employee_id));
    await conn.execute('DELETE FROM task_assignments WHERE task_id = ?', [taskId]);
    const rows = (assignmentsBody || []).filter((r) => r && r.employee_id != null);
    for (const row of rows) {
      const empId = Number(row.employee_id);
      if (!empId || Number.isNaN(empId)) continue;
      const st = ASSIGNMENT_STATUSES.has(row.status) ? row.status : 'pending';
      await conn.execute(
        'INSERT INTO task_assignments (task_id, employee_id, status) VALUES (?, ?, ?)',
        [taskId, empId, st]
      );
      if (!oldSet.has(empId)) {
        await notifyTaskAssignment(conn, taskId, empId, taskTitle);
      }
    }
    const firstId = rows.length ? Number(rows[0].employee_id) : null;
    const multi = rows.length > 1;
    await conn.execute(
      'UPDATE tasks SET assignee_id = ?, has_multiple_assignees = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [firstId, multi, taskId]
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

const DEPENDENCY_TYPES = new Set(['finish_to_start', 'start_to_start', 'finish_to_finish']);

function isStartBlockedByDependency(dependencyType, predStatus) {
  if (dependencyType === 'start_to_start') return predStatus === 'todo';
  if (dependencyType === 'finish_to_finish') return false;
  return predStatus !== 'done';
}

function isDoneBlockedByDependency(dependencyType, predStatus) {
  if (dependencyType === 'finish_to_finish' || dependencyType === 'finish_to_start') {
    return predStatus !== 'done';
  }
  if (dependencyType === 'start_to_start') return predStatus === 'todo';
  return false;
}

async function wouldCreateDependencyCycle(taskId, newDependsOnId) {
  if (Number(taskId) === Number(newDependsOnId)) return true;
  let frontier = [Number(newDependsOnId)];
  const seen = new Set(frontier);
  while (frontier.length) {
    const next = [];
    for (const tid of frontier) {
      const succs = await db.query(
        'SELECT task_id FROM task_dependencies WHERE depends_on_task_id = ?',
        [tid]
      );
      for (const s of succs) {
        const sid = Number(s.task_id);
        if (sid === Number(taskId)) return true;
        if (!seen.has(sid)) {
          seen.add(sid);
          next.push(sid);
        }
      }
    }
    frontier = next;
  }
  return false;
}

async function recomputeBlockingForProject(projectId) {
  if (projectId == null) return;
  const pid = Number(projectId);
  if (Number.isNaN(pid)) return;

  const tasks = await db.query('SELECT id, status FROM tasks WHERE project_id = ?', [pid]);
  const rows = await db.query(
    `
    SELECT td.task_id, td.depends_on_task_id, td.dependency_type, pt.status AS pred_status
    FROM task_dependencies td
    JOIN tasks pt ON pt.id = td.depends_on_task_id
    JOIN tasks t ON t.id = td.task_id AND t.project_id = ?
    `,
    [pid]
  );

  for (const t of tasks) {
    const myDeps = rows.filter((r) => Number(r.task_id) === Number(t.id));
    let blocked = false;
    for (const d of myDeps) {
      if (isStartBlockedByDependency(d.dependency_type, d.pred_status)) {
        blocked = true;
        break;
      }
    }
    await db.query('UPDATE tasks SET is_blocked = ? WHERE id = ?', [blocked, t.id]);
  }

  await db.query(
    `
    UPDATE tasks t
    SET dependency_count = (SELECT COUNT(*) FROM task_dependencies td WHERE td.task_id = t.id)
    WHERE project_id = ?
    `,
    [pid]
  );
}

async function recomputeBlockingForTasksByIds(taskIds) {
  const ids = [...new Set((taskIds || []).map(Number).filter((n) => !Number.isNaN(n) && n > 0))];
  const projects = new Set();
  for (const id of ids) {
    const r = await db.query('SELECT project_id FROM tasks WHERE id = ?', [id]);
    if (r.length && r[0].project_id != null) projects.add(r[0].project_id);
    const succs = await db.query(
      `SELECT t.project_id FROM task_dependencies td
       JOIN tasks t ON t.id = td.task_id WHERE td.depends_on_task_id = ?`,
      [id]
    );
    for (const s of succs) {
      if (s.project_id != null) projects.add(s.project_id);
    }
  }
  for (const p of projects) {
    await recomputeBlockingForProject(p);
  }
}

// Obtenir toutes les tâches du manager connecté avec assignations multiples
router.get('/manager/:managerId', async (req, res) => {
  try {
    const { managerId } = req.params;
    
    const tasks = await db.query(
      `
      SELECT t.*,
        IFNULL(ad.assignments, JSON_ARRAY()) AS assignments
      FROM tasks t
      LEFT JOIN (
        SELECT ta.task_id,
          JSON_ARRAYAGG(
            JSON_OBJECT(
              'employee_id', ta.employee_id,
              'status', ta.status,
              'assigned_at', ta.assigned_at,
              'completed_at', ta.completed_at,
              'employee_name', CONCAT(u.prenom, ' ', u.nom),
              'employee_initials', CONCAT(LEFT(u.prenom, 1), LEFT(u.nom, 1))
            )
          ) AS assignments
        FROM task_assignments ta
        INNER JOIN users u ON u.id = ta.employee_id
        GROUP BY ta.task_id
      ) ad ON ad.task_id = t.id
      WHERE t.creator_id = ? OR t.assignee_id = ?
        OR EXISTS (
          SELECT 1 FROM task_assignments tx
          WHERE tx.task_id = t.id AND tx.employee_id = ?
        )
      ORDER BY t.created_at DESC
      `,
      [managerId, managerId, managerId]
    );

    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des tâches:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des tâches'
    });
  }
});

// Notifications d'assignation (liste pour un employé)
router.get('/notifications/employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const rows = await db.query(
      `SELECT id, task_id, employee_id, type, message, is_read, created_at
       FROM task_notifications
       WHERE employee_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [employeeId]
    );
    const unread = await db.query(
      'SELECT COUNT(*) AS c FROM task_notifications WHERE employee_id = ? AND is_read = FALSE',
      [employeeId]
    );
    res.json({
      success: true,
      data: rows,
      unreadCount: unread[0]?.c ?? 0
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des notifications'
    });
  }
});

// Alertes : prédécesseur en retard qui bloque encore une tâche du projet
router.get('/dependency-alerts/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const rows = await db.query(
      `
      SELECT
        t.id AS dependent_task_id,
        t.title AS dependent_title,
        pt.id AS predecessor_id,
        pt.title AS predecessor_title,
        DATE(pt.due_date) AS predecessor_due,
        pt.status AS predecessor_status,
        td.dependency_type
      FROM task_dependencies td
      JOIN tasks t ON td.task_id = t.id
      JOIN tasks pt ON td.depends_on_task_id = pt.id
      WHERE t.project_id = ?
        AND pt.status <> 'done'
        AND t.status <> 'done'
        AND pt.due_date IS NOT NULL
        AND pt.due_date < CURDATE()
      ORDER BY pt.due_date ASC
      `,
      [projectId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Erreur dependency-alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des alertes de dépendances'
    });
  }
});

// Obtenir les tâches par statut (Kanban)
router.get('/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const { managerId } = req.query;

    const tasks = await db.query(
      `
      SELECT t.*,
        IFNULL(ad.assignments, JSON_ARRAY()) AS assignments
      FROM tasks t
      LEFT JOIN (
        SELECT ta.task_id,
          JSON_ARRAYAGG(
            JSON_OBJECT(
              'employee_id', ta.employee_id,
              'status', ta.status,
              'assigned_at', ta.assigned_at,
              'completed_at', ta.completed_at,
              'employee_name', CONCAT(u.prenom, ' ', u.nom),
              'employee_initials', CONCAT(LEFT(u.prenom, 1), LEFT(u.nom, 1))
            )
          ) AS assignments
        FROM task_assignments ta
        INNER JOIN users u ON u.id = ta.employee_id
        GROUP BY ta.task_id
      ) ad ON ad.task_id = t.id
      WHERE t.status = ?
        AND (
          t.creator_id = ?
          OR t.assignee_id = ?
          OR EXISTS (
            SELECT 1 FROM task_assignments tx
            WHERE tx.task_id = t.id AND tx.employee_id = ?
          )
        )
      ORDER BY t.created_at DESC
      `,
      [status, managerId, managerId, managerId]
    );

    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des tâches par statut:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des tâches'
    });
  }
});

// Créer une nouvelle tâche
router.post('/', async (req, res) => {
  try {
    console.log('Données reçues pour création de tâche:', req.body);
    
    const {
      title,
      description,
      priority = 'medium',
      assignee_id,
      assignee_ids,
      project_id,
      creator_id,
      due_date,
      start_date,
      estimated_hours,
      tags
    } = req.body;

    let employeeIds = [];
    if (Array.isArray(assignee_ids) && assignee_ids.length > 0) {
      employeeIds = [...new Set(assignee_ids.map(Number).filter((n) => !Number.isNaN(n) && n > 0))];
    } else if (assignee_id) {
      const n = Number(assignee_id);
      if (!Number.isNaN(n) && n > 0) employeeIds = [n];
    }
    const primaryAssignee = employeeIds.length > 0 ? employeeIds[0] : (assignee_id ? Number(assignee_id) : null);

    console.log('Valeurs extraites:', {
      title, description, priority, assignee_id, assignee_ids: employeeIds,
      project_id, creator_id, due_date, start_date,
      estimated_hours, tags
    });

    if (!title || !creator_id) {
      console.log('Validation échouée - titre ou creator_id manquant');
      return res.status(400).json({
        success: false,
        message: 'Le titre et le créateur sont obligatoires'
      });
    }

    const result = await db.query(`
      INSERT INTO tasks (
        title, description, priority, status, assignee_id,
        project_id, creator_id, due_date, start_date,
        estimated_hours, tags
      ) VALUES (?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?)
    `, [
      title,
      description || null,
      priority,
      primaryAssignee || null,
      project_id || null,
      creator_id,
      due_date || null,
      start_date || null,
      estimated_hours || null,
      tags ? JSON.stringify(tags) : null
    ]);

    console.log('Tâche insérée avec ID:', result.insertId);

    if (employeeIds.length > 0) {
      await insertAssignmentsForNewTask(result.insertId, employeeIds, title);
    }

    // Récupérer la tâche créée
    const [newTask] = await db.query('SELECT * FROM tasks WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Tâche créée avec succès',
      data: newTask
    });
  } catch (error) {
    console.error('Erreur lors de la création de la tâche:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la tâche'
    });
  }
});

// Mettre à jour une tâche avec historique d'édition
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { employee_id } = req.body;
    console.log('Mise à jour de la tâche:', id, 'avec données:', req.body);
    
    // Vérifier si la tâche existe
    const existingTask = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);
    if (existingTask.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tâche non trouvée'
      });
    }

    let assignmentSyncDone = false;
    if (Array.isArray(req.body.assignments)) {
      await syncTaskAssignmentsForTask(id, req.body.assignments, existingTask[0].title);
      assignmentSyncDone = true;
    }

    const skipAssigneeField = Array.isArray(req.body.assignments);

    // Construire dynamiquement la requête SQL
    const updates = [];
    const values = [];
    
    // Ajouter seulement les champs qui sont fournis et tracker les changements
    const fieldMapping = {
      title: 'title',
      description: 'description',
      priority: 'priority',
      status: 'status',
      assignee_id: 'assignee_id',
      project_id: 'project_id',
      due_date: 'due_date',
      start_date: 'start_date',
      end_date: 'end_date',
      estimated_hours: 'estimated_hours',
      actual_hours: 'actual_hours',
      progress: 'progress'
    };

    for (const [key, dbField] of Object.entries(fieldMapping)) {
      if (skipAssigneeField && key === 'assignee_id') {
        continue;
      }
      if (req.body[key] !== undefined) {
        const oldValue = existingTask[0][dbField];
        const newValue = req.body[key];
        
        // Enregistrer dans l'historique si la valeur a changé
        if (oldValue !== newValue && employee_id) {
          await db.query(`
            INSERT INTO task_edit_history (task_id, employee_id, field_name, old_value, new_value)
            VALUES (?, ?, ?, ?, ?)
          `, [id, employee_id, key, String(oldValue), String(newValue)]);
        }
        
        updates.push(`${dbField} = ?`);
        values.push(newValue);
      }
    }

    if (req.body.tags !== undefined) {
      const oldTags = existingTask[0].tags;
      const newTags = req.body.tags ? JSON.stringify(req.body.tags) : null;
      
      if (oldTags !== newTags && employee_id) {
        await db.query(`
          INSERT INTO task_edit_history (task_id, employee_id, field_name, old_value, new_value)
          VALUES (?, ?, ?, ?, ?)
        `, [id, employee_id, 'tags', String(oldTags), String(newTags)]);
      }
      
      updates.push('tags = ?');
      values.push(newTags);
    }
    
    // Ajouter toujours updated_at
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id); // Ajouter l'ID pour le WHERE
    
    if (updates.length === 1 && !assignmentSyncDone) {
      return res.status(400).json({
        success: false,
        message: 'Aucun champ à mettre à jour'
      });
    }

    // Construire la requête SQL
    const sql = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;
    console.log('SQL généré:', sql);
    console.log('Valeurs:', values);

    // Mettre à jour la tâche (sauf si seule la sync assignations a été faite sans autre champ)
    if (updates.length > 1) {
      await db.query(sql, values);
    }

    console.log('Tâche mise à jour avec succès:', id);

    // Récupérer la tâche mise à jour
    const [updatedTask] = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Tâche mise à jour avec succès',
      data: updatedTask
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la tâche:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la tâche'
    });
  }
});

// Supprimer une tâche
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier si la tâche existe
    const existingTask = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);
    if (existingTask.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tâche non trouvée'
      });
    }

    // Supprimer la tâche
    await db.query('DELETE FROM tasks WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Tâche supprimée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression de la tâche:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la tâche'
    });
  }
});

// Approuver une tâche
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(`
      UPDATE tasks SET 
        status = 'done', 
        end_date = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id]);

    await recomputeBlockingForTasksByIds([id]);

    res.json({
      success: true,
      message: 'Tâche approuvée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de l\'approbation de la tâche:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'approbation de la tâche'
    });
  }
});

// Mettre à jour le statut d'une tâche (pour le drag and drop)
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    console.log(`Mise à jour du statut de la tâche ${id} vers: ${status}`);

    const existingTask = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);
    if (existingTask.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tâche non trouvée'
      });
    }

    const predDeps = await db.query(
      `
      SELECT td.dependency_type, pt.status AS pred_status
      FROM task_dependencies td
      JOIN tasks pt ON pt.id = td.depends_on_task_id
      WHERE td.task_id = ?
      `,
      [id]
    );

    for (const d of predDeps) {
      if (status === 'in_progress' && isStartBlockedByDependency(d.dependency_type, d.pred_status)) {
        return res.status(400).json({
          success: false,
          message:
            'Cette tâche ne peut pas passer en cours : une dépendance (FS ou SS) sur une tâche prédécesseur non satisfaite.'
        });
      }
      if (status === 'done' && isDoneBlockedByDependency(d.dependency_type, d.pred_status)) {
        return res.status(400).json({
          success: false,
          message:
            'Cette tâche ne peut pas être terminée : une dépendance impose que la tâche prédécesseur soit dans un état compatible.'
        });
      }
    }

    await db.query(
      `
      UPDATE tasks SET
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [status, id]
    );

    console.log(`Statut de la tâche ${id} mis à jour vers: ${status}`);

    await recomputeBlockingForTasksByIds([id]);

    const [updatedTask] = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Statut de la tâche mis à jour avec succès',
      data: updatedTask
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut de la tâche:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut de la tâche'
    });
  }
});

// Rejeter une tâche
router.put('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await db.query(`
      UPDATE tasks SET 
        status = 'cancelled',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id]);

    res.json({
      success: true,
      message: 'Tâche rejetée'
    });
  } catch (error) {
    console.error('Erreur lors du rejet de la tâche:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du rejet de la tâche'
    });
  }
});

// ==================== MULTI-EMPLOYEE ASSIGNMENT ROUTES ====================

// Ajouter un employé à une tâche
router.post('/:id/assignments', async (req, res) => {
  try {
    const { id } = req.params;
    const { employee_id, status = 'pending' } = req.body;

    // Vérifier si la tâche existe
    const task = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);
    if (task.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tâche non trouvée'
      });
    }

    // Vérifier si l'employé existe
    const employee = await db.query('SELECT * FROM users WHERE id = ?', [employee_id]);
    if (employee.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employé non trouvé'
      });
    }

    const st = ASSIGNMENT_STATUSES.has(status) ? status : 'pending';

    // Ajouter l'assignation
    await db.query(`
      INSERT INTO task_assignments (task_id, employee_id, status)
      VALUES (?, ?, ?)
    `, [id, employee_id, st]);

    // Mettre à jour le flag has_multiple_assignees et assignee principal
    const assignmentCount = await db.query(
      'SELECT COUNT(*) as count FROM task_assignments WHERE task_id = ?',
      [id]
    );
    const cnt = Number(assignmentCount[0].count) || 0;
    const [rows] = await db.pool.query(
      'SELECT employee_id FROM task_assignments WHERE task_id = ? ORDER BY assigned_at ASC LIMIT 1',
      [id]
    );
    const firstEmp = rows.length ? rows[0].employee_id : null;
    await db.query(
      'UPDATE tasks SET has_multiple_assignees = ?, assignee_id = ? WHERE id = ?',
      [cnt > 1, firstEmp, id]
    );

    const conn = await db.getConnection();
    try {
      await notifyTaskAssignment(conn, id, employee_id, task[0].title);
    } finally {
      conn.release();
    }

    res.json({
      success: true,
      message: 'Employé assigné avec succès'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Cet employé est déjà assigné à cette tâche'
      });
    }
    console.error('Erreur lors de l\'assignation de l\'employé:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'assignation de l\'employé'
    });
  }
});

// Retirer un employé d'une tâche
router.delete('/:id/assignments/:employeeId', async (req, res) => {
  try {
    const { id, employeeId } = req.params;

    await db.query(`
      DELETE FROM task_assignments 
      WHERE task_id = ? AND employee_id = ?
    `, [id, employeeId]);

    const assignmentCount = await db.query(
      'SELECT COUNT(*) as count FROM task_assignments WHERE task_id = ?',
      [id]
    );
    const cnt = Number(assignmentCount[0].count) || 0;

    if (cnt === 0) {
      await db.query(
        'UPDATE tasks SET assignee_id = NULL, has_multiple_assignees = FALSE WHERE id = ?',
        [id]
      );
    } else {
      const [rows] = await db.pool.query(
        'SELECT employee_id FROM task_assignments WHERE task_id = ? ORDER BY assigned_at ASC LIMIT 1',
        [id]
      );
      const firstEmp = rows.length ? rows[0].employee_id : null;
      await db.query(
        'UPDATE tasks SET assignee_id = ?, has_multiple_assignees = ? WHERE id = ?',
        [firstEmp, cnt > 1, id]
      );
    }

    res.json({
      success: true,
      message: 'Employé retiré de la tâche avec succès'
    });
  } catch (error) {
    console.error('Erreur lors du retrait de l\'employé:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du retrait de l\'employé'
    });
  }
});

// Mettre à jour le statut d'assignation d'un employé
router.put('/:id/assignments/:employeeId/status', async (req, res) => {
  try {
    const { id, employeeId } = req.params;
    const { status } = req.body;

    const st = ASSIGNMENT_STATUSES.has(status) ? status : 'pending';

    if (st === 'completed') {
      await db.query(
        `UPDATE task_assignments
         SET status = ?, completed_at = NOW()
         WHERE task_id = ? AND employee_id = ?`,
        [st, id, employeeId]
      );
    } else {
      await db.query(
        `UPDATE task_assignments
         SET status = ?, completed_at = NULL
         WHERE task_id = ? AND employee_id = ?`,
        [st, id, employeeId]
      );
    }

    res.json({
      success: true,
      message: 'Statut d\'assignation mis à jour avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut d\'assignation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut d\'assignation'
    });
  }
});

// ==================== TASK DEPENDENCY ROUTES ====================

// Obtenir les dépendances d'une tâche
router.get('/:id/dependencies', async (req, res) => {
  try {
    const { id } = req.params;

    const dependencies = await db.query(`
      SELECT td.*, 
        pt.title as depends_on_task_title,
        pt.status as depends_on_task_status
      FROM task_dependencies td
      JOIN tasks pt ON td.depends_on_task_id = pt.id
      WHERE td.task_id = ?
    `, [id]);

    res.json({
      success: true,
      data: dependencies
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des dépendances:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des dépendances'
    });
  }
});

// Ajouter une dépendance entre tâches
router.post('/:id/dependencies', async (req, res) => {
  try {
    const { id } = req.params;
    let { depends_on_task_id, dependency_type = 'finish_to_start', lag_days = 0 } = req.body;

    if (!DEPENDENCY_TYPES.has(dependency_type)) {
      dependency_type = 'finish_to_start';
    }

    const task = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);
    if (task.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tâche non trouvée'
      });
    }

    const dependsOnTask = await db.query('SELECT * FROM tasks WHERE id = ?', [depends_on_task_id]);
    if (dependsOnTask.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tâche de dépendance non trouvée'
      });
    }

    const p1 = task[0].project_id;
    const p2 = dependsOnTask[0].project_id;
    if (p1 != null && p2 != null && Number(p1) !== Number(p2)) {
      return res.status(400).json({
        success: false,
        message: 'Les deux tâches doivent appartenir au même projet pour créer une dépendance.'
      });
    }

    if (await wouldCreateDependencyCycle(id, depends_on_task_id)) {
      return res.status(400).json({
        success: false,
        message: 'Cette dépendance créerait un cycle entre les tâches.'
      });
    }

    await db.query(`
      INSERT INTO task_dependencies (task_id, depends_on_task_id, dependency_type, lag_days)
      VALUES (?, ?, ?, ?)
    `, [id, depends_on_task_id, dependency_type, lag_days || 0]);

    const projectId = task[0].project_id;
    if (projectId != null) {
      await recomputeBlockingForProject(projectId);
    } else {
      await recomputeBlockingForTasksByIds([id, depends_on_task_id]);
    }

    res.json({
      success: true,
      message: 'Dépendance ajoutée avec succès'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Cette dépendance existe déjà.'
      });
    }
    console.error('Erreur lors de l\'ajout de la dépendance:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout de la dépendance'
    });
  }
});

// Obtenir les dépendances d'un projet
router.get('/project/:projectId/dependencies', async (req, res) => {
  try {
    const { projectId } = req.params;
    const dependencies = await db.query(
      `
      SELECT td.task_id, td.depends_on_task_id
      FROM task_dependencies td
      JOIN tasks t ON t.id = td.task_id
      WHERE t.project_id = ?
      `,
      [projectId]
    );

    res.json({
      success: true,
      data: dependencies
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des dépendances de projet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des dépendances de projet'
    });
  }
});

// Supprimer une dépendance
router.delete('/:id/dependencies/:dependsOnTaskId', async (req, res) => {
  try {
    const { id, dependsOnTaskId } = req.params;

    const before = await db.query('SELECT project_id FROM tasks WHERE id = ?', [id]);

    await db.query(`
      DELETE FROM task_dependencies 
      WHERE task_id = ? AND depends_on_task_id = ?
    `, [id, dependsOnTaskId]);

    if (before.length && before[0].project_id != null) {
      await recomputeBlockingForProject(before[0].project_id);
    } else {
      await recomputeBlockingForTasksByIds([id, dependsOnTaskId]);
    }

    res.json({
      success: true,
      message: 'Dépendance supprimée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression de la dépendance:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la dépendance'
    });
  }
});

// ==================== TASK TIME TRACKING ROUTES ====================

// Démarrer une session de temps pour une tâche
router.post('/:id/time-sessions', async (req, res) => {
  try {
    const { id } = req.params;
    const { employee_id, description } = req.body;

    if (!employee_id) {
      return res.status(400).json({ success: false, message: 'employee_id requis.' });
    }

    // Vérifier que la tâche existe et que l'employé y est affecté (assignee_id OU task_assignments)
    const tasks = await db.query(
      `SELECT t.id FROM tasks t
       WHERE t.id = ?
         AND (t.assignee_id = ?
              OR EXISTS (SELECT 1 FROM task_assignments ta
                         WHERE ta.task_id = t.id AND ta.employee_id = ?))`,
      [id, employee_id, employee_id]
    );
    if (tasks.length === 0) {
      return res.status(404).json({ success: false, message: 'Tâche introuvable ou non assignée à cet employé.' });
    }

    // Auto-expirer les sessions bloquées depuis plus de 16h (déconnexion sans checkout)
    await db.query(
      `UPDATE task_time_sessions
       SET status = 'completed', end_time = DATE_ADD(start_time, INTERVAL duration_seconds SECOND),
           updated_at = CURRENT_TIMESTAMP
       WHERE employee_id = ? AND status = 'running'
         AND TIMESTAMPDIFF(HOUR, start_time, NOW()) > 16`,
      [employee_id]
    );

    // Vérifier si une session active (running ou paused) est déjà en cours
    const activeSessions = await db.query(
      `SELECT id, task_id, status FROM task_time_sessions
       WHERE employee_id = ? AND status IN ('running', 'paused')`,
      [employee_id]
    );

    if (activeSessions.length > 0) {
      const active = activeSessions[0];
      return res.status(409).json({
        success: false,
        message: `Une session ${active.status === 'running' ? 'en cours' : 'en pause'} existe déjà sur la tâche #${active.task_id}. Terminez ou mettez-la en pause avant d'en démarrer une nouvelle.`,
        data: { activeSessionId: active.id, activeTaskId: active.task_id, activeStatus: active.status }
      });
    }

    // Vérifier les dépendances avant de commencer le travail
    const predDeps = await db.query(
      `
      SELECT td.dependency_type, pt.status AS pred_status
      FROM task_dependencies td
      JOIN tasks pt ON pt.id = td.depends_on_task_id
      WHERE td.task_id = ?
      `,
      [id]
    );

    for (const d of predDeps) {
      if (isStartBlockedByDependency(d.dependency_type, d.pred_status)) {
        return res.status(400).json({
          success: false,
          message: "Cette tâche ne peut pas démarrer : une dépendance prédécesseur n'est pas satisfaite."
        });
      }
    }

    // Créer la nouvelle session
    const result = await db.query(`
      INSERT INTO task_time_sessions (task_id, employee_id, start_time, status, description)
      VALUES (?, ?, NOW(), 'running', ?)
    `, [id, employee_id, description || null]);

    // Automatiquement passer la tâche à in_progress
    await db.query('UPDATE tasks SET status = ? WHERE id = ?', ['in_progress', id]);

    res.json({
      success: true,
      message: 'Session de temps démarrée et tâche mise à jour',
      data: { sessionId: result.insertId }
    });
  } catch (error) {
    console.error('Erreur lors du démarrage de la session:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du démarrage de la session'
    });
  }
});

// Mettre en pause une session
router.put('/:id/time-sessions/:sessionId/pause', async (req, res) => {
  try {
    const { id, sessionId } = req.params;

    // Calculer la durée
    const session = await db.query(`
      SELECT start_time FROM task_time_sessions 
      WHERE id = ? AND task_id = ? AND status = 'running'
    `, [sessionId, id]);

    if (session.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Session non trouvée ou déjà terminée'
      });
    }

    const duration = Math.floor((new Date() - new Date(session[0].start_time)) / 1000);

    await db.query(`
      UPDATE task_time_sessions 
      SET status = 'paused', end_time = NOW(), duration_seconds = ?
      WHERE id = ?
    `, [duration, sessionId]);

    res.json({
      success: true,
      message: 'Session mise en pause',
      data: { duration }
    });
  } catch (error) {
    console.error('Erreur lors de la mise en pause:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise en pause'
    });
  }
});

// Reprendre une session
router.put('/:id/time-sessions/:sessionId/resume', async (req, res) => {
  try {
    const { id, sessionId } = req.params;

    const session = await db.query(`
      SELECT * FROM task_time_sessions 
      WHERE id = ? AND task_id = ?
    `, [sessionId, id]);

    if (session.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Session non trouvée pour cette tâche'
      });
    }

    const employeeId = session[0].employee_id;
    const otherRunning = await db.query(`
      SELECT * FROM task_time_sessions 
      WHERE employee_id = ? AND status = 'running' AND id != ?
    `, [employeeId, sessionId]);

    if (otherRunning.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de reprendre cette session : un autre pointage est déjà en cours pour cet employé.'
      });
    }

    await db.query(`
      UPDATE task_time_sessions 
      SET status = 'running', start_time = NOW(), end_time = NULL
      WHERE id = ? AND task_id = ?
    `, [sessionId, id]);

    res.json({
      success: true,
      message: 'Session reprise'
    });
  } catch (error) {
    console.error('Erreur lors de la reprise:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la reprise'
    });
  }
});

// Terminer une session
router.put('/:id/time-sessions/:sessionId/complete', async (req, res) => {
  try {
    const { id, sessionId } = req.params;

    // Calculer la durée finale
    const session = await db.query(`
      SELECT start_time, duration_seconds, employee_id FROM task_time_sessions 
      WHERE id = ? AND task_id = ?
    `, [sessionId, id]);

    if (session.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Session non trouvée'
      });
    }

    const employeeId = session[0].employee_id;
    let duration;
    if (session[0].status === 'running') {
      duration = Math.floor((new Date() - new Date(session[0].start_time)) / 1000);
    } else {
      duration = session[0].duration_seconds;
    }

    await db.query(`
      UPDATE task_time_sessions 
      SET status = 'completed', end_time = NOW(), duration_seconds = ?
      WHERE id = ?
    `, [duration, sessionId]);

    // Mettre à jour les heures réelles de la tâche
    await db.query(`
      UPDATE tasks 
      SET actual_hours = actual_hours + (? / 3600)
      WHERE id = ?
    `, [duration, id]);

    // Passer la tâche à done automatiquement
    await db.query('UPDATE tasks SET status = ? WHERE id = ?', ['done', id]);

    // Créer automatiquement une entrée timesheet pour aujourd'hui
    const hours = parseFloat((duration / 3600).toFixed(2));
    await db.query(`
      INSERT INTO timesheets (employee_id, date, task_id, hours, description, status)
      VALUES (?, CURDATE(), ?, ?, ?, ?)
    `, [employeeId, id, hours, `Pointage tâche #${id}`, 'pending']);

    res.json({
      success: true,
      message: 'Session terminée, tâche complétée et timesheet créé',
      data: { duration, hours }
    });
  } catch (error) {
    console.error('Erreur lors de la terminaison:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la terminaison'
    });
  }
});

// Obtenir les sessions de temps d'une tâche
router.get('/:id/time-sessions', async (req, res) => {
  try {
    const { id } = req.params;

    const sessions = await db.query(`
      SELECT tts.*, 
        CONCAT(u.prenom, ' ', u.nom) as employee_name,
        t.title as task_title
      FROM task_time_sessions tts
      JOIN users u ON tts.employee_id = u.id
      LEFT JOIN tasks t ON tts.task_id = t.id
      WHERE tts.task_id = ?
      ORDER BY tts.start_time DESC
    `, [id]);

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des sessions'
    });
  }
});

// Obtenir les sessions de temps d'aujourd'hui pour l'employé (pour le timesheet)
router.get('/employee/:employeeId/today-sessions', async (req, res) => {
  try {
    const { employeeId } = req.params;

    const sessions = await db.query(`
      SELECT tts.*, 
        t.title as task_title,
        (tts.duration_seconds / 3600) as hours
      FROM task_time_sessions tts
      LEFT JOIN tasks t ON tts.task_id = t.id
      WHERE tts.employee_id = ? AND DATE(tts.start_time) = CURDATE()
      ORDER BY tts.start_time DESC
    `, [employeeId]);

    const totalHours = sessions.reduce((sum, s) => sum + (s.duration_seconds / 3600), 0);

    res.json({
      success: true,
      data: {
        sessions,
        totalHours: parseFloat(totalHours.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des sessions d\'aujourd\'hui:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des sessions'
    });
  }
});

// Obtenir l'historique d'édition d'une tâche
router.get('/:id/edit-history', async (req, res) => {
  try {
    const { id } = req.params;

    const history = await db.query(`
      SELECT teh.*, 
        CONCAT(u.prenom, ' ', u.nom) as employee_name
      FROM task_edit_history teh
      JOIN users u ON teh.employee_id = u.id
      WHERE teh.task_id = ?
      ORDER BY teh.changed_at DESC
    `, [id]);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique'
    });
  }
});

module.exports = router;
