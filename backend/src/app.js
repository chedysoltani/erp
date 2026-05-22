const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET manquant dans .env — arrêt du serveur.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:4200').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS: origine non autorisée'));
  },
  credentials: true
}));

app.use(helmet());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de requêtes. Ralentissez.' }
});

app.use('/api/users/login', loginLimiter);
app.use('/api/', apiLimiter);

app.get('/', (req, res) => {
  res.json({
    message: 'SIT ERP System — API Node.js + MySQL',
    version: '1.0.0',
    status: 'running'
  });
});

const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const timesheetRoutes = require('./routes/timesheet');
const meetingRoutes = require('./routes/meetings');
const employeeRoutes = require('./routes/employee');
const employeeSkillsRoutes = require('./routes/employeeSkills');
const managerRoutes = require('./routes/manager');
const documentRoutes = require('./routes/documents');
const analyticsRoutes = require('./routes/analytics');
const iaRoutes = require('./routes/ia');
const attendanceRoutes = require('./routes/attendance');

app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/timesheet', timesheetRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/employee', employeeSkillsRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ia', iaRoutes);
app.use('/api/attendance', attendanceRoutes);

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use((err, req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development';
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: isDev ? err.message : 'Erreur interne du serveur'
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Route non trouvée' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} [${process.env.NODE_ENV}]`);
});
