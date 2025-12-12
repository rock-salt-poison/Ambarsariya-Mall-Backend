const express = require('express');
const router = express.Router();
const rolesController = require('../controllers/Admin/RolesController');

// get routes for AmbarsariyaMall
router.get('/departments', rolesController.get_departments);
router.get('/permissions', rolesController.get_permissions);
router.get('/staff-types', rolesController.get_staff_types);
router.get('/employees', rolesController.get_role_employees);

module.exports = router;