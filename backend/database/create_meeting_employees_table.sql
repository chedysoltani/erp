-- Création de la table de liaison entre les réunions et les employés
CREATE TABLE IF NOT EXISTS meeting_employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  meeting_id INT NOT NULL,
  employee_id INT NOT NULL,
  status ENUM('pending', 'accepted', 'declined', 'tentative') DEFAULT 'pending',
  response_time TIMESTAMP NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
  
  UNIQUE KEY unique_meeting_employee (meeting_id, employee_id),
  INDEX idx_meeting (meeting_id),
  INDEX idx_employee (employee_id),
  INDEX idx_status (status)
);
