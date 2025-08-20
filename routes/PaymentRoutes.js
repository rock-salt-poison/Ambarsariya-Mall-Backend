const express = require('express');
const router = express.Router();
const razorpayController = require('../controllers/Razorpay_Controller');

// Google Drive routes

router.post('/create-order', razorpayController.post_createOrder);
router.post('/verify-payment', razorpayController.post_verifyPayment);
router.post('/create-contact', razorpayController.post_createContact);
router.post('/create-fund-account', razorpayController.post_createFundAccount);
router.post('/payout', razorpayController.post_payoutToShopkeeper);
router.get('/payment-details/:payment_id', razorpayController.get_paymentDetails);
router.get('/payout-details/:payout_id', razorpayController.get_payoutDetails);

module.exports = router;