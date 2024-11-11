const express = require('express');
const router = express.Router();
const ambarsariyaController = require('../controllers/AmbarsariyaMall_Controller');
const eshopController = require('../controllers/Eshop_Controller');

// routes for AmbarsariyaMall
router.get('/domains', ambarsariyaController.get_domains);
router.get('/sectors', ambarsariyaController.get_sectors);
router.get('/domain-sectors/:id', ambarsariyaController.get_domainSectors);
router.get('/type-of-services', ambarsariyaController.get_typeOfServices);
router.post('/sell/eshop', eshopController.post_book_eshop);
router.put('/sell/buyeshop/:shopAccessToken', eshopController.update_eshop);
router.get('/sell/shop-user-data', eshopController.get_shopUserData);
router.get('/sell/shops', eshopController.get_allShops);

module.exports = router;
