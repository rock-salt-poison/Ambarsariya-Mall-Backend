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
router.post('/request-dynamic-google-access', driveController.post_requestDynamicGoogleAccess);
router.get('/auth/google/callback', driveController.get_handleAuthCallback);
router.get('/auth/google/callback2', driveController.handleAuthCallback2);
router.get('/image/:fileId', driveController.get_imageLink);
router.get('/sheet/:sheetId', driveController.get_sheetsData);
router.get('/google/contacts/:member_id/:user_id', driveController.getGoogleContacts);
router.get('/user-scopes', driveController.get_userScopes);


module.exports = router;