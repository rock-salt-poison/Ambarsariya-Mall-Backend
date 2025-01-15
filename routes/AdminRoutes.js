const express = require('express');
const router = express.Router();
const adminController = require('../controllers/Admin/Admin_Controller');

// routes for AmbarsariyaMall
router.get('/travel-time/:mode/:travel_type', adminController.get_travel_time);
router.get('/countries', adminController.get_countries);
router.get('/notices', adminController.get_notice);
router.get('/notice/:title', adminController.get_notice);

router.post('/travel-time', adminController.post_travel_time);
router.post('/countries', adminController.post_countries);
router.post('/notice', adminController.post_notice);

module.exports = router;