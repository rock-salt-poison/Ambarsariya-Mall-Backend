const express = require('express');
const router = express.Router();
const adminController = require('../controllers/Admin/Admin_Controller');

// routes for AmbarsariyaMall
router.get('/travel-time/:mode/:travel_type', adminController.get_travel_time);

router.post('/travel-time', adminController.post_travel_time);


module.exports = router;
