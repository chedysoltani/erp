const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'SIT ERP System - API Node.js + MySQL',
    company: 'SIT',
    version: '1.0.0',
    status: 'running'
  });
});

// Import routes
const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const timesheetRoutes = require('./routes/timesheet');
const meetingRoutes = require('./routes/meetings');
const employeeRoutes = require('./routes/employee');
const employeeSkillsRoutes = require('./routes/employeeSkills');
const managerRoutes = require('./routes/manager');
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/timesheet', timesheetRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/employee', employeeSkillsRoutes);
app.use('/api/manager', managerRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});
