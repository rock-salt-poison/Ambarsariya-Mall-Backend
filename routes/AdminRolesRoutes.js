const express = require('express');
const router = express.Router();
const rolesController = require('../controllers/Admin/RolesController');

// get routes for AmbarsariyaMall
router.get('/departments', rolesController.get_departments);
router.get('/permissions', rolesController.get_permissions);
router.get('/staff-types', rolesController.get_staff_types);
router.get('/employees', rolesController.get_role_employees);
router.get('/staff/:token', rolesController.get_staff);
router.get('/staff-with-type/:token/:staff_type', rolesController.get_staff_with_type);
router.get('/staff-tasks/:token', rolesController.get_staff_tasks);

router.post('/create-role', rolesController.create_role_employee);
router.post('/staff-email-otp', rolesController.store_email_otp);
router.post('/verify-staff-email-otp', rolesController.verifyStaffEmailOtp);
router.post('/create-staff_task', rolesController.create_staff_task);

router.put('/create-staff', rolesController.create_staff);

module.exports = router;