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
router.get('/advt', adminController.get_advt);
router.get('/advt/:advt_page', adminController.get_advt);
router.get('/famous-areas', adminController.get_support_page_famous_areas);


// post routes for AmbarsariyaMall
router.post('/travel-time', adminController.post_travel_time);
router.post('/countries', adminController.post_countries);
router.post('/notice', UploadFiles.single('img'), adminController.post_notice);
router.post('/led-board-messages', adminController.post_led_board_message);
router.post('/advt', adminController.post_advt);
router.post('/famous-areas', adminController.post_support_page_famous_areas);


// delete routes for AmbarsariyaMall
router.delete('/led-board-message/:id', adminController.delete_led_board_message);
router.delete('/notice/:title/:id', adminController.delete_notice);
router.delete('/advt/:id', adminController.delete_advt);
router.delete('/famous-area', adminController.delete_support_page_famous_area);


module.exports = router;