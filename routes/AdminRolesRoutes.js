const express = require('express');
const router = express.Router();
const rolesController = require('../controllers/Admin/RolesController');

// get routes for AmbarsariyaMall
router.get('/departments', rolesController.get_departments);
router.get('/permissions', rolesController.get_permissions);
router.get('/staff-types', rolesController.get_staff_types);
router.get('/check-email/:email', rolesController.check_email_exists);
router.get('/employees', rolesController.get_role_employees);
router.get('/staff/:token', rolesController.get_staff);
router.get('/staff-with-type/:token/:staff_type', rolesController.get_staff_with_type);
router.get('/staff-tasks/:token', rolesController.get_staff_tasks);
router.get('/staff-task-detail/:token', rolesController.get_staff_task_with_token);
router.get('/tasks/:assigned_by/:assigned_to', rolesController.get_staff_member_tasks);
router.get('/staff-task-report/:task_id/:task_reporting_date', rolesController.get_staff_task_report_details);

router.post('/create-role', rolesController.create_role_employee);
router.post('/staff-email-otp', rolesController.store_email_otp);
router.post('/verify-staff-email-otp', rolesController.verifyStaffEmailOtp);
router.post('/create-staff_task', rolesController.create_staff_task);
router.post('/task-report-details', rolesController.create_task_report);

router.put('/create-staff', rolesController.create_staff);

router.delete('/delete-credentials/:credentials_id', rolesController.delete_auth_credentials);

module.exports = router;