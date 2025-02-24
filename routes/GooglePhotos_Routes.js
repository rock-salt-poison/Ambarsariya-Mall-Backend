const express = require('express');
const router = express.Router();
const photosController = require('../controllers/Photos_Controller');

// Google Drive routes

router.post('/convert-google-photos', photosController.post_convertGooglePhotos);


module.exports = router;