const express = require('express');
const router = express.Router();
const adminController = require('../controllers/Admin/Admin_Controller');
const eshopController = require('../controllers/Eshop_Controller');
const UploadFiles = require('../Middleware/UploadFiles');
const multer = require('multer');

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
// router.post('/notice', UploadFiles.single('img'), adminController.post_notice);
router.post("/notice", (req, res, next) => {
    UploadFiles.single("img")(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          // Handle Multer errors
          console.log(err);
          
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ error: "File size exceeds the 1MB limit." });
          }
        } else if (err) {
          // Handle other errors
          return res.status(400).json({ error: err.message });
        }
      }
      // If no errors, call the controller function
      adminController.post_notice(req, res);
    });
  });
router.post('/led-board-messages', adminController.post_led_board_message);
router.post('/advt', adminController.post_advt);
// router.post('/famous-areas', adminController.post_support_page_famous_areas);
router.post("/famous-areas", (req, res, next) => {
  console.log("🚀 Raw Request Body (before multer):", req.body);

  UploadFiles.any()(req, res, (err) => {
    console.log("📂 Processed Files:", req.files); // Debugging file uploads

    if (err) {
      console.log("❌ Multer Error:", err);
      return res.status(400).json({ error: err.message });
    }

    // Call the controller function
    adminController.post_support_page_famous_areas(req, res);
  });
});



// delete routes for AmbarsariyaMall
router.delete('/led-board-message/:id', adminController.delete_led_board_message);
router.delete('/notice/:title/:id', adminController.delete_notice);
router.delete('/advt/:id', adminController.delete_advt);
router.delete('/famous-area', adminController.delete_support_page_famous_area);


module.exports = router;