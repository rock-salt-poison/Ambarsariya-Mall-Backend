const express = require('express');
const router = express.Router();
const driveController = require('../controllers/Drive_Controller');

// Google Drive routes

router.post('/open-file/:email', driveController.post_openFile);


module.exports = router;
