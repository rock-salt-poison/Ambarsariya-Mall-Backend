const express = require('express');
const router = express.Router();
const ambarsariyaController = require('../controllers/AmbarsariyaMall_Controller');
const eshopController = require('../controllers/Eshop_Controller');
const otpController = require('../controllers/Otp_Controller');
const usernameOtpController = require('../controllers/UserNameOtp_controller');
const productController = require('../controllers/Product_Controller');
const purchaseController = require('../controllers/PurchaseOrder_Controller');
const saleController = require('../controllers/SaleOrder_Controller');
const UploadFiles = require('../Middleware/UploadFiles');
const multer = require('multer');


// routes for AmbarsariyaMall
router.get('/domains', ambarsariyaController.get_domains);
router.get('/sectors', ambarsariyaController.get_sectors);
router.get('/domain-sectors/:id', ambarsariyaController.get_domainSectors);
router.get('/type-of-services', ambarsariyaController.get_typeOfServices);
router.get('/service/:id', ambarsariyaController.get_typeOfService);

router.get('/category/:category_id', ambarsariyaController.get_category_name);
router.get('/categories', ambarsariyaController.get_categoriesList);
router.post('/sell/eshop', eshopController.post_book_eshop);
// router.put('/sell/buyeshop/:shopAccessToken', eshopController.update_eshop);
router.put("/sell/buyeshop/:shopAccessToken", (req, res, next) => {
    UploadFiles.single("usp_values")(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          // Handle Multer errors
          console.log(err);
          
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ error: "File size exceeds the 1MB limit." });
          }
        } else if (err) {
          // Handle other errors
          return res.status(400).json({ error: err.message });
        }
      }
      // If no errors, call the controller function
      eshopController.update_eshop(req, res);
    });
  });


router.get('/sell/shop-user-data', eshopController.get_shopUserData);
router.get('/sell/shops', eshopController.get_allShops);
router.get('/sell/other-shops', eshopController.get_otherShops);
router.post('/sell/login', eshopController.post_authLogin);
// router.post('/sell/member', eshopController.post_member_data);

router.post("/sell/member", (req, res, next) => {
    UploadFiles.fields([
      { name: "profile_img", maxCount: 1 },
      { name: "bg_img", maxCount: 1 }
    ])(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          console.log(err);
          
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ error: "File size exceeds the 1MB limit." });
          }
        } else {
          return res.status(400).json({ error: err.message });
        }
      }
      // If no errors, call the controller function
      eshopController.post_member_data(req, res);
    });
  });
  

router.get('/sell/member', eshopController.get_memberData);
router.get('/sell/user', eshopController.get_userData);
router.get('/sell/support/:token', eshopController.get_visitorData);
router.get('/sell/discount-coupons/:shop_no', eshopController.get_discountCoupons);
router.get('/sell/products/:shop_no', productController.get_products);
router.get('/sell/product-names/:shop_no', productController.get_product_names);
router.get('/sell/products/:shop_no/:product_id', productController.get_products);
router.get('/sell/product-variants/:shop_no/:variant_group', productController.get_product_variants);
router.get('/purchase_order/:po_access_token', purchaseController.get_purchase_order_details);
router.get('/purchase_orders/:seller_id', purchaseController.get_purchase_orders);

router.post('/sell/support', eshopController.post_visitorData);
router.post('/sell/coupons/:shop_no', eshopController.post_discount_coupons);
router.post('/sell/products', productController.post_products);
router.post('/sell/verify_otp', eshopController.post_verify_otp);
router.post('/purchase_order', purchaseController.post_purchaseOrder);
router.post('/sale_order', saleController.post_saleOrder);

// router.put('/sell/support', eshopController.put_visitorData);
router.put('/sell/forget-password', eshopController.put_forgetPassword);

router.put("/sell/support", (req, res, next) => {
  UploadFiles.single("file")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        // Handle Multer errors
        console.log(err);
        
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "File size exceeds the 1MB limit." });
        }
      } else if (err) {
        // Handle other errors
        return res.status(400).json({ error: err.message });
      }
    }
    // If no errors, call the controller function
    eshopController.put_visitorData(req, res);
  });
});


router.put('/sell/send-otp', otpController.sendOTP);
router.post('/sell/username-otp', usernameOtpController.sendOTP);


module.exports = router;
