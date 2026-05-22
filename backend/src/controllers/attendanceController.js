const db = require('../config/database');

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function minutesBetween(a, b) {
  return Math.floor((new Date(b) - new Date(a)) / 60000);
}

function toDecimalHours(minutes) {
  return Math.round((minutes / 60) * 100) / 100;
}

class AttendanceController {

  // ── CHECK-IN ──────────────────────────────────────────────────────────────
  static async checkIn(req, res) {
    const connection = await db.getConnection();
    try {
      const employee_id = req.params.employeeId || req.user.id;
      const today = getToday();
      const now = new Date();
      const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();

      // Vérifier si déjà pointé aujourd'hui
      const [[existing]] = await connection.execute(
        'SELECT id, check_in_time, status FROM attendance_records WHERE employee_id = ? AND date = ?',
        [employee_id, today]
      );
      if (existing && existing.check_in_time) {
        return res.status(409).json({
          success: false,
          message: 'Vous avez déjà pointé votre arrivée aujourd\'hui.'
        });
      }

      // Récupérer l'horaire du jour
      const [[schedule]] = await connection.execute(
        'SELECT start_time, is_working_day FROM work_schedules WHERE employee_id = ? AND day_of_week = ?',
        [employee_id, dayOfWeek]
      );

      let lateMinutes = 0;
      let attendanceStatus = 'present';

      if (schedule && schedule.is_working_day && schedule.start_time) {
        const [sh, sm] = schedule.start_time.split(':').map(Number);
        const scheduledStart = new Date(now);
        scheduledStart.setHours(sh, sm, 0, 0);

        if (now > scheduledStart) {
          lateMinutes = minutesBetween(scheduledStart, now);
          if (lateMinutes > 15) attendanceStatus = 'late';
        }
      }

      const deviceInfo = req.headers['user-agent']?.substring(0, 500) || null;
      const ipAddress = req.ip || req.connection.remoteAddress;

      if (existing) {
        // Enregistrement existe sans check_in (ex: congé annulé, absence pré-créée) → UPDATE
        await connection.query(
          `UPDATE attendance_records
           SET check_in_time = ?, status = ?, late_minutes = ?, ip_address = ?, device_info = ?, updated_at = NOW()
           WHERE id = ?`,
          [now, attendanceStatus, lateMinutes, ipAddress, deviceInfo, existing.id]
        );
      } else {
        await connection.query(
          `INSERT INTO attendance_records
           (employee_id, date, check_in_time, status, late_minutes, ip_address, device_info)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [employee_id, today, now, attendanceStatus, lateMinutes, ipAddress, deviceInfo]
        );
      }

      res.json({
        success: true,
        message: lateMinutes > 0
          ? `Arrivée enregistrée avec ${lateMinutes} minutes de retard.`
          : 'Arrivée enregistrée avec succès.',
        data: {
          check_in_time: now,
          status: attendanceStatus,
          late_minutes: lateMinutes
        }
      });
    } catch (error) {
      console.error('Erreur checkIn:', error);
      res.status(500).json({ success: false, message: 'Erreur lors du pointage d\'arrivée.' });
    } finally {
      connection.release();
    }
  }

  // ── CHECK-OUT ─────────────────────────────────────────────────────────────
  static async checkOut(req, res) {
    const connection = await db.getConnection();
    try {
      const employee_id = req.params.employeeId || req.user.id;
      const today = getToday();
      const now = new Date();

      const [[record]] = await connection.execute(
        'SELECT id, check_in_time, check_out_time, status FROM attendance_records WHERE employee_id = ? AND date = ?',
        [employee_id, today]
      );

      if (!record) {
        return res.status(400).json({ success: false, message: 'Aucun pointage d\'arrivée trouvé pour aujourd\'hui.' });
      }
      if (record.check_out_time) {
        return res.status(409).json({ success: false, message: 'Vous avez déjà pointé votre départ aujourd\'hui.' });
      }

      const checkInTime = new Date(record.check_in_time);
      const totalMinutes = minutesBetween(checkInTime, now);
      const totalHours = toDecimalHours(totalMinutes);

      // Calcul des heures supplémentaires (si > 8h de travail effectif)
      const workMinutes = totalMinutes - 60; // Déduire 1h de pause déjeuner estimée
      const overtimeMinutes = Math.max(0, workMinutes - 480); // 480min = 8h standard

      // Départ anticipé (schedule end_time)
      const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
      const [[schedule]] = await connection.execute(
        'SELECT end_time FROM work_schedules WHERE employee_id = ? AND day_of_week = ?',
        [employee_id, dayOfWeek]
      );

      let earlyLeaveMinutes = 0;
      if (schedule?.end_time) {
        const [eh, em] = schedule.end_time.split(':').map(Number);
        const scheduledEnd = new Date(now);
        scheduledEnd.setHours(eh, em, 0, 0);
        if (now < scheduledEnd) {
          earlyLeaveMinutes = minutesBetween(now, scheduledEnd);
        }
      }

      await connection.query(
        `UPDATE attendance_records
         SET check_out_time = ?, total_hours = ?, overtime_minutes = ?,
             early_leave_minutes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [now, totalHours, overtimeMinutes, earlyLeaveMinutes, record.id]
      );

      res.json({
        success: true,
        message: 'Départ enregistré avec succès.',
        data: {
          check_out_time: now,
          total_hours: totalHours,
          overtime_minutes: overtimeMinutes,
          early_leave_minutes: earlyLeaveMinutes
        }
      });
    } catch (error) {
      console.error('Erreur checkOut:', error);
      res.status(500).json({ success: false, message: 'Erreur lors du pointage de départ.' });
    } finally {
      connection.release();
    }
  }

  // ── STATUT DU JOUR ────────────────────────────────────────────────────────
  static async getTodayStatus(req, res) {
    try {
      const employee_id = req.params.employeeId || req.user.id;
      const today = getToday();

      const [record] = await db.query(
        `SELECT ar.*,
                ws.start_time AS scheduled_start, ws.end_time AS scheduled_end
         FROM attendance_records ar
         LEFT JOIN work_schedules ws ON ws.employee_id = ar.employee_id
           AND ws.day_of_week = DAYOFWEEK(ar.date) - 1
         WHERE ar.employee_id = ? AND ar.date = ?`,
        [employee_id, today]
      );

      // Si aucun enregistrement, retourner l'horaire prévu
      if (!record) {
        const dayOfWeek = new Date().getDay() === 0 ? 7 : new Date().getDay();
        const [schedule] = await db.query(
          'SELECT start_time, end_time, is_working_day FROM work_schedules WHERE employee_id = ? AND day_of_week = ?',
          [employee_id, dayOfWeek]
        );
        return res.json({
          success: true,
          data: {
            status: 'not_checked_in',
            schedule: schedule || { start_time: '08:30:00', end_time: '17:30:00', is_working_day: true }
          }
        });
      }

      res.json({ success: true, data: record });
    } catch (error) {
      console.error('Erreur getTodayStatus:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la récupération du statut.' });
    }
  }

  // ── HISTORIQUE EMPLOYÉ ────────────────────────────────────────────────────
  static async getEmployeeHistory(req, res) {
    try {
      const employee_id = req.params.employeeId;
      const { from, to, limit = 30 } = req.query;

      let sql = `
        SELECT ar.*,
               CONCAT(u.prenom, ' ', u.nom) AS employee_name,
               CONCAT(m.prenom, ' ', m.nom) AS validator_name
        FROM attendance_records ar
        LEFT JOIN users u ON u.id = ar.employee_id
        LEFT JOIN users m ON m.id = ar.validated_by
        WHERE ar.employee_id = ?`;
      const params = [employee_id];

      if (from) { sql += ' AND ar.date >= ?'; params.push(from); }
      if (to)   { sql += ' AND ar.date <= ?'; params.push(to); }

      sql += ' ORDER BY ar.date DESC LIMIT ?';
      params.push(parseInt(limit));

      const records = await db.query(sql, params);

      // Stats du mois courant
      const firstOfMonth = new Date();
      firstOfMonth.setDate(1);
      const statsFrom = firstOfMonth.toISOString().split('T')[0];

      const stats = await db.query(
        `SELECT
           COUNT(*) AS total_days,
           SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) AS present_days,
           SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END)   AS absent_days,
           SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END)     AS late_days,
           SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END)    AS leave_days,
           COALESCE(SUM(total_hours), 0)                        AS total_hours,
           COALESCE(AVG(late_minutes), 0)                       AS avg_late_minutes,
           COALESCE(SUM(overtime_minutes), 0)                   AS total_overtime
         FROM attendance_records
         WHERE employee_id = ? AND date >= ?`,
        [employee_id, statsFrom]
      );

      res.json({ success: true, data: { records, stats: stats[0] } });
    } catch (error) {
      console.error('Erreur getEmployeeHistory:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la récupération de l\'historique.' });
    }
  }

  // ── VUE MANAGER : PRÉSENCE ÉQUIPE ─────────────────────────────────────────
  static async getTeamAttendance(req, res) {
    try {
      const { date, managerId } = req.query;
      const targetDate = date || getToday();

      const employees = await db.query(
        `SELECT u.id AS employee_id,
                CONCAT_WS(' ', u.prenom, u.nom) AS employee_name,
                u.email,
                ar.id AS record_id,
                ar.check_in_time, ar.check_out_time, ar.status,
                ar.late_minutes, ar.total_hours, ar.overtime_minutes,
                ar.manager_validated, ar.manager_note,
                ws.start_time AS scheduled_start, ws.end_time AS scheduled_end
         FROM users u
         LEFT JOIN attendance_records ar ON ar.employee_id = u.id AND ar.date = ?
         LEFT JOIN work_schedules ws ON ws.employee_id = u.id
           AND ws.day_of_week = DAYOFWEEK(?) - 1
         WHERE u.role = 'employee' AND u.actif = 1
         ORDER BY u.nom, u.prenom`,
        [targetDate, targetDate]
      );

      const summary = {
        total: employees.length,
        present: employees.filter(e => e.status === 'present').length,
        late: employees.filter(e => e.status === 'late').length,
        absent: employees.filter(e => !e.status || e.status === 'absent').length,
        leave: employees.filter(e => e.status === 'leave').length
      };

      res.json({ success: true, data: { employees, summary, date: targetDate } });
    } catch (error) {
      console.error('Erreur getTeamAttendance:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la récupération de la présence.' });
    }
  }

  // ── VALIDER UN ENREGISTREMENT (MANAGER) ──────────────────────────────────
  static async validateAttendance(req, res) {
    try {
      const { recordId } = req.params;
      const { note } = req.body;
      const manager_id = req.user.id;

      await db.query(
        `UPDATE attendance_records
         SET manager_validated = TRUE, validated_by = ?, validated_at = CURRENT_TIMESTAMP,
             manager_note = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [manager_id, note || null, recordId]
      );

      res.json({ success: true, message: 'Pointage validé.' });
    } catch (error) {
      console.error('Erreur validateAttendance:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la validation.' });
    }
  }

  // ── CORRIGER UN POINTAGE (MANAGER) ────────────────────────────────────────
  static async correctAttendance(req, res) {
    try {
      const { recordId } = req.params;
      const { check_in_time, check_out_time, status, manager_note } = req.body;
      const manager_id = req.user.id;

      let totalHours = 0;
      if (check_in_time && check_out_time) {
        const mins = minutesBetween(new Date(check_in_time), new Date(check_out_time));
        totalHours = toDecimalHours(mins);
      }

      await db.query(
        `UPDATE attendance_records
         SET check_in_time = ?, check_out_time = ?, status = ?,
             total_hours = ?, manager_validated = TRUE, validated_by = ?,
             validated_at = CURRENT_TIMESTAMP, manager_note = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [check_in_time || null, check_out_time || null, status, totalHours, manager_id, manager_note || null, recordId]
      );

      res.json({ success: true, message: 'Pointage corrigé.' });
    } catch (error) {
      console.error('Erreur correctAttendance:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la correction.' });
    }
  }

  // ── DEMANDE DE CONGÉ ──────────────────────────────────────────────────────
  static async requestLeave(req, res) {
    try {
      const employee_id = req.params.employeeId || req.user.id;
      const { type, start_date, end_date, reason } = req.body;

      if (!start_date || !end_date) {
        return res.status(400).json({ success: false, message: 'Dates de congé obligatoires.' });
      }

      const startD = new Date(start_date);
      const endD   = new Date(end_date);
      if (endD < startD) {
        return res.status(400).json({ success: false, message: 'La date de fin doit être après la date de début.' });
      }

      const daysCount = Math.ceil((endD - startD) / (1000 * 60 * 60 * 24)) + 1;

      await db.query(
        `INSERT INTO leave_requests (employee_id, type, start_date, end_date, days_count, reason, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [employee_id, type || 'vacation', start_date, end_date, daysCount, reason || null]
      );

      res.json({ success: true, message: `Demande de congé soumise pour ${daysCount} jour(s).` });
    } catch (error) {
      console.error('Erreur requestLeave:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la demande de congé.' });
    }
  }

  // ── RÉPONDRE À UNE DEMANDE DE CONGÉ (MANAGER) ────────────────────────────
  static async respondLeave(req, res) {
    try {
      const { requestId } = req.params;
      const { status, response_note } = req.body;
      const manager_id = req.user.id;

      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Statut invalide. Utilisez approved ou rejected.' });
      }

      await db.query(
        `UPDATE leave_requests
         SET status = ?, manager_id = ?, response_note = ?, responded_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [status, manager_id, response_note || null, requestId]
      );

      // Si approuvé, créer automatiquement les enregistrements de présence "leave"
      if (status === 'approved') {
        const [req_data] = await db.query(
          'SELECT employee_id, start_date, end_date FROM leave_requests WHERE id = ?',
          [requestId]
        );
        if (req_data) {
          const start = new Date(req_data.start_date);
          const end   = new Date(req_data.end_date);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            await db.query(
              `INSERT IGNORE INTO attendance_records (employee_id, date, status, manager_validated, validated_by)
               VALUES (?, ?, 'leave', TRUE, ?)`,
              [req_data.employee_id, dateStr, manager_id]
            );
          }
        }
      }

      res.json({ success: true, message: status === 'approved' ? 'Congé approuvé.' : 'Congé refusé.' });
    } catch (error) {
      console.error('Erreur respondLeave:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la réponse.' });
    }
  }

  // ── DEMANDES DE CONGÉ EN ATTENTE (MANAGER) ───────────────────────────────
  static async getPendingLeaves(req, res) {
    try {
      const leaves = await db.query(
        `SELECT lr.*, CONCAT(u.prenom, ' ', u.nom) AS employee_name, u.email
         FROM leave_requests lr
         JOIN users u ON u.id = lr.employee_id
         WHERE lr.status = 'pending'
         ORDER BY lr.created_at DESC`,
        []
      );
      res.json({ success: true, data: leaves });
    } catch (error) {
      console.error('Erreur getPendingLeaves:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la récupération des congés.' });
    }
  }

  // ── MES DEMANDES DE CONGÉ ─────────────────────────────────────────────────
  static async getMyLeaves(req, res) {
    try {
      const employee_id = req.params.employeeId || req.user.id;
      const leaves = await db.query(
        `SELECT lr.*, CONCAT(m.prenom, ' ', m.nom) AS manager_name
         FROM leave_requests lr
         LEFT JOIN users m ON m.id = lr.manager_id
         WHERE lr.employee_id = ?
         ORDER BY lr.created_at DESC`,
        [employee_id]
      );
      res.json({ success: true, data: leaves });
    } catch (error) {
      console.error('Erreur getMyLeaves:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la récupération des congés.' });
    }
  }

  // ── STATISTIQUES MENSUELLES (MANAGER DASHBOARD) ───────────────────────────
  static async getMonthlyStats(req, res) {
    try {
      const { year, month } = req.query;
      const now = new Date();
      const y = parseInt(year) || now.getFullYear();
      const m = parseInt(month) || now.getMonth() + 1;
      const fromDate = `${y}-${String(m).padStart(2, '0')}-01`;
      const toDate   = new Date(y, m, 0).toISOString().split('T')[0];

      const stats = await db.query(
        `SELECT
           u.id AS employee_id,
           CONCAT_WS(' ', u.prenom, u.nom) AS employee_name,
           COUNT(ar.id)                                               AS total_records,
           SUM(CASE WHEN ar.status IN ('present','late') THEN 1 ELSE 0 END) AS present_days,
           SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END)    AS absent_days,
           SUM(CASE WHEN ar.status = 'late'   THEN 1 ELSE 0 END)    AS late_days,
           SUM(CASE WHEN ar.status = 'leave'  THEN 1 ELSE 0 END)    AS leave_days,
           COALESCE(SUM(ar.total_hours), 0)                          AS total_hours,
           COALESCE(SUM(ar.overtime_minutes), 0)                     AS total_overtime_min,
           COALESCE(AVG(ar.late_minutes), 0)                         AS avg_late_min
         FROM users u
         LEFT JOIN attendance_records ar ON ar.employee_id = u.id
           AND ar.date BETWEEN ? AND ?
         WHERE u.role = 'employee' AND u.actif = 1
         GROUP BY u.id, u.nom, u.prenom
         ORDER BY u.nom`,
        [fromDate, toDate]
      );

      res.json({ success: true, data: { stats, period: { year: y, month: m, fromDate, toDate } } });
    } catch (error) {
      console.error('Erreur getMonthlyStats:', error);
      res.status(500).json({ success: false, message: 'Erreur lors des statistiques mensuelles.' });
    }
  }
}

module.exports = AttendanceController;
