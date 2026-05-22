-- ============================================================
-- SYSTÈME DE POINTAGE EMPLOYÉ — SIT ERP
-- ============================================================

-- Horaires de travail par employé
CREATE TABLE IF NOT EXISTS work_schedules (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  employee_id     INT NOT NULL,
  day_of_week     TINYINT NOT NULL COMMENT '1=Lundi, 7=Dimanche',
  start_time      TIME NOT NULL DEFAULT '08:30:00',
  end_time        TIME NOT NULL DEFAULT '17:30:00',
  is_working_day  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_employee_day (employee_id, day_of_week),
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Enregistrements de présence quotidiens
CREATE TABLE IF NOT EXISTS attendance_records (
  id                  INT PRIMARY KEY AUTO_INCREMENT,
  employee_id         INT NOT NULL,
  date                DATE NOT NULL,
  check_in_time       DATETIME,
  check_out_time      DATETIME,
  status              ENUM('present','absent','late','half_day','leave','holiday') NOT NULL DEFAULT 'absent',
  late_minutes        INT DEFAULT 0,
  early_leave_minutes INT DEFAULT 0,
  overtime_minutes    INT DEFAULT 0,
  total_hours         DECIMAL(5,2) DEFAULT 0.00,
  ip_address          VARCHAR(45),
  device_info         VARCHAR(500),
  manager_validated   BOOLEAN DEFAULT FALSE,
  validated_by        INT,
  validated_at        DATETIME,
  manager_note        TEXT,
  employee_note       TEXT,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_employee_date (employee_id, date),
  INDEX idx_employee   (employee_id),
  INDEX idx_date       (date),
  INDEX idx_status     (status),
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (validated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Demandes de congés / absences
CREATE TABLE IF NOT EXISTS leave_requests (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  employee_id   INT NOT NULL,
  type          ENUM('vacation','sick','personal','maternity','paternity','other') NOT NULL DEFAULT 'vacation',
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  days_count    INT DEFAULT 1,
  status        ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reason        TEXT,
  manager_id    INT,
  response_note TEXT,
  responded_at  DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_employee (employee_id),
  INDEX idx_status   (status),
  INDEX idx_dates    (start_date, end_date),
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (manager_id)  REFERENCES users(id) ON DELETE SET NULL
);

-- Horaires par défaut pour tous les employés existants (Lun-Ven 08:30-17:30)
INSERT IGNORE INTO work_schedules (employee_id, day_of_week, start_time, end_time, is_working_day)
SELECT u.id, d.day, '08:30:00', '17:30:00',
       CASE WHEN d.day BETWEEN 1 AND 5 THEN TRUE ELSE FALSE END
FROM users u
CROSS JOIN (SELECT 1 AS day UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
            UNION SELECT 5 UNION SELECT 6 UNION SELECT 7) d
WHERE u.role = 'employee';
