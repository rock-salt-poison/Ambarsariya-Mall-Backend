const express = require('express');
const router = express.Router();
const crmController = require('../controllers/Serve/CRM/CRM_Controller');

// Google Drive routes

router.get('/customer-records/:start_date/:end_date/:shop_no', crmController.get_customer_records);
router.get('/completed-orders/:start_date/:end_date/:shop_no/:buyer_id', crmController.get_completed_orders);
router.get('/pending-orders/:start_date/:end_date/:shop_no/:buyer_id', crmController.get_pending_orders);


module.exports = router;