const express = require('express');
const router = express.Router();
const rolesController = require('../controllers/Admin/RolesController');

// get routes for AmbarsariyaMall
router.get('/departments', rolesController.get_departments);
router.get('/permissions', rolesController.get_permissions);
router.get('/staff-types', rolesController.get_staff_types);
router.get('/employees', rolesController.get_role_employees);
router.get('/staff/:token', rolesController.get_staff);

router.post('/create-role', rolesController.create_role_employee);
router.put('/create-staff', rolesController.create_staff);
router.post('/staff-email-otp', rolesController.store_staff_email_otp);
router.post('/verify-staff-email-otp', rolesController.verifyStaffEmailOtp);

module.exports = router;