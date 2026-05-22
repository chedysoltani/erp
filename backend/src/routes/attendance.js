const express = require('express');
const router = express.Router();
const AttendanceController = require('../controllers/attendanceController');
const { auth, isManager, isEmployee } = require('../middleware/auth');

// ── EMPLOYÉ ────────────────────────────────────────────────────────────────
router.post('/employee/:employeeId/checkin',  auth, isEmployee, AttendanceController.checkIn);
router.post('/employee/:employeeId/checkout', auth, isEmployee, AttendanceController.checkOut);
router.get('/employee/:employeeId/today',     auth, isEmployee, AttendanceController.getTodayStatus);
router.get('/employee/:employeeId/history',   auth, isEmployee, AttendanceController.getEmployeeHistory);

// Congés employé
router.post('/employee/:employeeId/leave',    auth, isEmployee, AttendanceController.requestLeave);
router.get('/employee/:employeeId/leaves',    auth, isEmployee, AttendanceController.getMyLeaves);

// ── MANAGER ────────────────────────────────────────────────────────────────
router.get('/team',                            auth, isManager, AttendanceController.getTeamAttendance);
router.put('/records/:recordId/validate',      auth, isManager, AttendanceController.validateAttendance);
router.put('/records/:recordId/correct',       auth, isManager, AttendanceController.correctAttendance);
router.get('/leaves/pending',                  auth, isManager, AttendanceController.getPendingLeaves);
router.put('/leaves/:requestId/respond',       auth, isManager, AttendanceController.respondLeave);
router.get('/stats/monthly',                   auth, isManager, AttendanceController.getMonthlyStats);

module.exports = router;
