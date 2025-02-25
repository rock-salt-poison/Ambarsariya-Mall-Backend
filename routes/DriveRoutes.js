const express = require('express');
const router = express.Router();
const driveController = require('../controllers/Drive_Controller');

// Google Drive routes

router.post('/open-file/:email', driveController.post_openFile);
router.get('/check-drive-access/:email', driveController.get_checkDriveAccess);
router.get('/request-drive-access', driveController.get_requestDriveAccess);
router.get('/auth/google/callback', driveController.get_handleAuthCallback);
router.get('/image/:fileId', driveController.get_imageLink);
router.get('/sheet/:sheetId', driveController.get_sheetsData);


module.exports = router;