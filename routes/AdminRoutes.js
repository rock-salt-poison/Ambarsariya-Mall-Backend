const express = require('express');
const router = express.Router();
const adminController = require('../controllers/Admin/Admin_Controller');
const eshopController = require('../controllers/Eshop_Controller');
const UploadFiles = require('../Middleware/UploadFiles')

// get routes for AmbarsariyaMall
router.get('/travel-time/:mode/:travel_type', adminController.get_travel_time);
router.get('/countries', adminController.get_countries);
router.get('/notices', adminController.get_notice);
router.get('/notice/:title/:id', adminController.get_notice);
router.get('/led-board-messages', adminController.get_led_board_message);
router.get('/users/:user_type', eshopController.get_allUsers);


// post routes for AmbarsariyaMall
router.post('/travel-time', adminController.post_travel_time);
router.post('/countries', adminController.post_countries);
router.post('/notice', UploadFiles.single('img'), adminController.post_notice);
router.post('/led-board-messages', adminController.post_led_board_message);


// delete routes for AmbarsariyaMall
router.delete('/led-board-message/:id', adminController.delete_led_board_message);
router.delete('/notice/:title/:id', adminController.delete_notice);


module.exports = router;