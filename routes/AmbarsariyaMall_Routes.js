const express = require('express');
const router = express.Router();
const ambarsariyaController = require('../controllers/AmbarsariyaMall_Controller');
const eshopController = require('../controllers/Eshop_Controller');
const otpController = require('../controllers/Otp_Controller');

// routes for AmbarsariyaMall
router.get('/domains', ambarsariyaController.get_domains);
router.get('/sectors', ambarsariyaController.get_sectors);
router.get('/domain-sectors/:id', ambarsariyaController.get_domainSectors);
router.get('/type-of-services', ambarsariyaController.get_typeOfServices);
router.get('/allCategories', ambarsariyaController.get_categories);
router.get('/categories', ambarsariyaController.get_categoriesList);
router.post('/sell/eshop', eshopController.post_book_eshop);
router.put('/sell/buyeshop/:shopAccessToken', eshopController.update_eshop);
router.get('/sell/shop-user-data', eshopController.get_shopUserData);
router.get('/sell/shops', eshopController.get_allShops);
router.get('/sell/other-shops', eshopController.get_otherShops);
router.post('/sell/login', eshopController.post_authLogin);
router.post('/sell/member', eshopController.post_member_data);
router.get('/sell/member', eshopController.get_memberData);
router.get('/sell/user', eshopController.get_userData);
router.get('/sell/support/:token', eshopController.get_visitorData);

router.post('/sell/support', eshopController.post_support_name_password);
router.post('/sell/coupons/:shop_no', eshopController.post_discount_coupons);

router.put('/sell/support', eshopController.put_visitorData);
router.put('/sell/forget-password', eshopController.put_forgetPassword);

router.put('/sell/send-otp', otpController.sendOTP);

module.exports = router;
