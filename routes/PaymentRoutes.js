const express = require('express');
const router = express.Router();
const razorpayController = require('../controllers/Razorpay_Controller');

// Google Drive routes

router.post('/create-order', razorpayController.post_createOrder);
router.post('/verify-payment', razorpayController.post_verifyPayment);


module.exports = router;