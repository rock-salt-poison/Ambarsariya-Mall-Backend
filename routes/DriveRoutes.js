const express = require('express');
const router = express.Router();
const driveController = require('../controllers/Drive_Controller');

// Google Drive routes

router.post('/open-file/:email', driveController.post_openFile);
router.post('/open-items-file/:email/:shop_no', driveController.post_openItemsCSVFile);
router.post('/open-sku-file/:email/:shop_no', driveController.post_openSKUCSVFile);
router.post('/open-rku-file/:email/:shop_no', driveController.post_openRKUCSVFile);
router.get('/check-drive-access/:email', driveController.get_checkDriveAccess);
router.get('/check-google-access/:email', driveController.get_checkGoogleAccess);
router.get('/request-drive-access', driveController.get_requestDriveAccess);
router.get('/request-google-access/:username', driveController.get_requestGoogleAccess);
router.get('/auth/google/callback', driveController.get_handleAuthCallback);
router.get('/image/:fileId', driveController.get_imageLink);
router.get('/sheet/:sheetId', driveController.get_sheetsData);


module.exports = router;