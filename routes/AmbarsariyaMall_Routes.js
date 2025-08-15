const express = require("express");
const router = express.Router();
const ambarsariyaController = require("../controllers/AmbarsariyaMall_Controller");
const eshopController = require("../controllers/Eshop_Controller");
const otpController = require("../controllers/Otp_Controller");
const usernameOtpController = require("../controllers/UserNameOtp_controller");
const productController = require("../controllers/Product_Controller");
const purchaseController = require("../controllers/PurchaseOrder_Controller");
const itemController = require("../controllers/Item_Controller");
const skuController = require("../controllers/SKU_Controller");
const rkuController = require("../controllers/RKU_Controller");
const saleController = require("../controllers/SaleOrder_Controller");
const invoiceController = require("../controllers/Invoice_Controller");
const mouController = require("../controllers/MoU_Controller");
const coHelperController = require("../controllers/CoHelper_Controller");
const UploadFiles = require("../Middleware/UploadFiles");
const multer = require("multer");

// routes for AmbarsariyaMall
router.get("/domains", ambarsariyaController.get_domains);
router.get("/sectors", ambarsariyaController.get_sectors);
router.get("/domain-sectors/:id", ambarsariyaController.get_domainSectors);
router.get("/type-of-services", ambarsariyaController.get_typeOfServices);
router.get("/service/:id", ambarsariyaController.get_typeOfService);

router.get("/category/:category_id", ambarsariyaController.get_category_name);
router.get(
  "/category/name/:category_name",
  ambarsariyaController.get_category_id
);
router.get("/categories", ambarsariyaController.get_categoriesList);
router.get(
  "/sell/check-member-exists",
  eshopController.get_checkIfMemberExists
);
router.get("/sell/check-shop-exists", eshopController.get_checkIfShopExists);
router.get(
  "/sell/check-paid-shop-exists",
  eshopController.get_checkIfPaidShopExists
);

router.post("/sell/eshop", eshopController.post_book_eshop);
// router.put('/sell/buyeshop/:shopAccessToken', eshopController.update_eshop);
router.put("/sell/buyeshop/:shopAccessToken", (req, res, next) => {
  UploadFiles.single("usp_values")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        // Handle Multer errors
        console.log(err);

        if (err.code === "LIMIT_FILE_SIZE") {
          return res
            .status(400)
            .json({ error: "File size exceeds the 1MB limit." });
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

router.put(
  "/sell/update-merchant",
  eshopController.update_shop_user_to_merchant
);
router.put(
  "/sell/eshop/update-location",
  eshopController.update_eshop_location
);
router.put(
  "/sell/eshop/update-status",
  eshopController.update_shop_is_open_status
);

router.put(
  "/sell/eshop/update-parking-status",
  eshopController.update_shop_parking_status
);
router.put("/sell/near-by-shop", eshopController.put_near_by_shops);

router.get("/sell/shop-user-data", eshopController.get_shopUserData);
router.get("/sell/shops", eshopController.get_allShops);
router.get("/sell/other-shops", eshopController.get_otherShops);
router.get(
  "/sell/near-by-area/:shopToken/:shop_no",
  eshopController.get_nearby_areas_for_shop
);
router.post("/sell/login", eshopController.post_authLogin);
// router.post('/sell/member', eshopController.post_member_data);

router.post("/sell/member", (req, res, next) => {
  UploadFiles.fields([
    { name: "profile_img", maxCount: 1 },
    { name: "bg_img", maxCount: 1 },
  ])(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        console.log(err);

        if (err.code === "LIMIT_FILE_SIZE") {
          return res
            .status(400)
            .json({ error: "File size exceeds the 1MB limit." });
        }
      } else {
        return res.status(400).json({ error: err.message });
      }
    }
    // If no errors, call the controller function
    eshopController.post_member_data(req, res);
  });
});

router.get("/sell/member", eshopController.get_memberData);
router.get("/sell/user", eshopController.get_userData);
router.get("/sell/support/:token/:sender_id", eshopController.get_visitorData);
router.get(
  "/sell/discount-coupons/:shop_no",
  eshopController.get_discountCoupons
);
router.get(
  "/sell/coupons/:shop_no",
  eshopController.get_coupons
);
router.get("/sell/products/:shop_no", productController.get_products);
router.get("/sell/product-names/:shop_no", productController.get_product_names);
router.get(
  "/sell/products/:shop_no/:product_id/:item_id",
  productController.get_products
);
// router.get('/sell/product-variants/:shop_no/:variant_group', productController.get_product_variants);
router.get(
  "/sell/product-variants/:product_id",
  productController.get_product_variants
);
router.get(
  "/purchase_order/:po_access_token",
  purchaseController.get_purchase_order_details
);
router.get("/purchase_orders/:po_no", purchaseController.get_purchase_orders);
router.get("/purchased-order/:po_no", purchaseController.get_purchased_order);
router.get("/buyer-details/:po_no", purchaseController.get_buyer_details);
router.get(
  "/purchase_order_no/:seller_id/:date",
  purchaseController.get_purchase_order_numbers
);
router.get(
  "/purchased_orders/:buyer_id",
  purchaseController.get_all_purchased_orders
);
router.get("/sell/items/:shop_no", itemController.get_items);
router.get("/sell/sku/:shop_no", skuController.get_sku);
router.get(
  "/sell/support-chat-notifications/:shop_no",
  eshopController.get_supportChatNotifications
);
router.get(
  "/sell/support-chat-messages/:support_id/:notification_id",
  eshopController.get_supportChatMessages
);
router.get("/sell/emotional/:member_id", eshopController.get_member_emotional);
router.get("/sell/personal/:member_id", eshopController.get_member_personal);
router.get(
  "/sell/relations/:member_id/:user_id",
  eshopController.get_member_relations
);
router.get(
  "/sell/relation/:member_id/:access_token",
  eshopController.get_member_relation_detail
);
router.get(
  "/sell/relation-types/:member_id",
  eshopController.get_member_relation_types
);
router.get(
  "/sell/relation-specific-groups/:member_id/:selectedRelation",
  eshopController.get_member_relation_specific_groups
);
router.get(
  "/sell/professional/:member_id/:user_id",
  eshopController.get_member_professional
);
router.patch(
  "/sell/support/:support_id/response",
  eshopController.patch_supportChatResponse
);
router.get(
  "/sell/member-share-level/:member_id",
  eshopController.get_member_share_level
);
router.get(
  "/event-purpose/:event_type",
  eshopController.get_member_event_purpose
);
router.get(
  "/event-purpose-engagement/:event_type/:event_purpose_id",
  eshopController.get_member_event_purpose_engagement
);
router.get("/sell/events/:member_id", eshopController.get_member_events);
router.get(
  "/sell/product-search/domains",
  eshopController.get_existing_domains
);
router.get(
  "/sell/product-search/sectors",
  eshopController.get_existing_sectors
);
router.get(
  "/sell/product-search/product",
  eshopController.get_searched_products
);
router.get("/shop/categories", eshopController.get_shop_categories);
router.get("/shop/products", eshopController.get_shop_products);
router.get("/shop/product-items", eshopController.get_shop_product_items);

router.get("/sale_orders/:seller_id", saleController.get_sale_orders);
router.get("/sale_order_no/:seller_id", saleController.get_sale_order_numbers);
router.get("/invoice/:invoice_no", invoiceController.get_invoice_orders);
router.get("/buyer-data/:user_id", invoiceController.get_buyer_details);
router.get("/seller-data/:shop_no", invoiceController.get_seller_details);
router.get(
  "/purchased-products-data/:product_id/:item_id",
  invoiceController.get_purchased_products_details
);
router.get("/merchants", eshopController.get_merchant_users);
router.get("/category-wise-shops", eshopController.get_category_wise_shops);
router.get(
  "/mou-selected-shops-products",
  eshopController.get_mou_selected_shops_products
);
router.get(
  "/in-stock-products/:shop_no",
  productController.get_in_stock_updates
);
router.get("/sell/mou/vendor-details", eshopController.get_vendor_details);
router.get("/sell/mou", mouController.get_mou);
router.get("/sell/shop-review/:shop_no/:reviewer_id", eshopController.get_member_shop_review);
router.get("/sell/shop-comments-and-replies", eshopController.get_shop_comments_with_replies);
router.get("/sell/co-helper/:member_id/:co_helper_type", coHelperController.get_coHelper);
router.get("/sell/co-helpers-by-type-and-service/:co_helper_type/:key_service/:buyer_member", coHelperController.get_coHelpers_by_type_and_service);
router.get("/sell/co-helper-by-type-service-member/:co_helper_type/:key_service/:member_id", coHelperController.get_coHelpers_by_type_service_member_id);
router.get("/sell/co-helper-member-notifications/:member_id", coHelperController.get_member_notifications);
router.get("/sell/co-helper-details/:id/:member_id", coHelperController.get_co_helper_popup_details);
router.get("/sell/shop-details-with-access-token/:shop_access_token", eshopController.get_shop_details_with_shop_access_token);

router.post("/sell/support", eshopController.post_visitorData);
router.post("/sell/coupons/:shop_no", eshopController.post_discount_coupons);
router.post("/sell/products", productController.post_products);
router.post("/sell/verify_otp", eshopController.post_verify_otp);
router.post("/purchase_order", purchaseController.post_purchaseOrder);
router.post("/sale_order", saleController.post_saleOrder);
router.post("/sell/items", itemController.post_items);
router.post("/sell/sku", skuController.post_sku);
router.post("/sell/rku", rkuController.post_rku);
router.post("/sell/support/chat", eshopController.post_supportChatMessage);
router.post(
  "/sell/emotional/:member_id",
  eshopController.post_member_emotional
);
router.post(
  "/sell/professional/:member_id/:user_id",
  eshopController.post_member_professional
);
router.post(
  "/sell/relations/:member_id/:user_id",
  eshopController.post_member_relations
);
router.post("/create-invoice", invoiceController.post_invoiceOrder);
router.put("/sell/member-share-level", eshopController.put_member_share_level);

router.post("/sell/events/:member_id", (req, res, next) => {
  UploadFiles.single("file")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        // Handle Multer errors
        console.log(err);

        if (err.code === "LIMIT_FILE_SIZE") {
          return res
            .status(400)
            .json({ error: "File size exceeds the 1MB limit." });
        }
      } else if (err) {
        // Handle other errors
        return res.status(400).json({ error: err.message });
      }
    }
    // If no errors, call the controller function
    eshopController.post_member_events(req, res);
  });
});

router.post("/sell/community", (req, res, next) => {
  UploadFiles.single("file")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        // Handle Multer errors
        console.log(err);

        if (err.code === "LIMIT_FILE_SIZE") {
          return res
            .status(400)
            .json({ error: "File size exceeds the 1MB limit." });
        }
      } else if (err) {
        // Handle other errors
        return res.status(400).json({ error: err.message });
      }
    }
    // If no errors, call the controller function
    eshopController.post_member_community(req, res);
  });
});

// router.post('/sell/personal/:member_id', (req, res, next) => {
//   UploadFiles.fields([
//     { name: 'personal_traits_file', maxCount: 1 },
//     { name: 'hobby_and_interests_file', maxCount: 1 },
//     { name: 'goals_and_aspirations_file', maxCount: 1 },
//     { name: 'favorite_quotes_or_mottos_file', maxCount: 1 },
//     { name: 'values_and_beliefs_file', maxCount: 1 },
//     { name: 'life_philosophy_file', maxCount: 1 },
//     { name: 'background_information_file', maxCount: 1 },
//     { name: 'unique_personal_facts_file', maxCount: 1 },
//   ])(req, res, (err) => {
//     if (err) {
//       if (err instanceof multer.MulterError) {
//         console.log(err);

//         if (err.code === "LIMIT_FILE_SIZE") {
//           return res.status(400).json({ message: "File size exceeds the 1MB limit." });
//         }
//       } else {
//         console.log(err.message);
//         return res.status(400).json({ message: err.message });
//       }
//     }
//     // If no errors, call the controller function
//     eshopController.post_member_personal(req, res);
//   });
// });

// router.put('/sell/support', eshopController.put_visitorData);
router.post("/sell/personal/:member_id", eshopController.post_member_personal);

router.put("/sell/forget-password", eshopController.put_forgetPassword);

router.put("/sell/support", (req, res, next) => {
  UploadFiles.single("file")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        // Handle Multer errors
        console.log(err);

        if (err.code === "LIMIT_FILE_SIZE") {
          return res
            .status(400)
            .json({ error: "File size exceeds the 1MB limit." });
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

router.put("/sell/send-otp", otpController.sendOTP);
router.post("/sell/username-otp", usernameOtpController.sendOTP);
router.post("/sell/shop-review", eshopController.post_shop_review);
router.post("/sell/shop-comment", eshopController.post_shop_comment);
router.post("/sell/shop-comment-reply", eshopController.post_shop_comment_reply);
router.post(
  "/sell/identification-of-mou",
  mouController.post_identification_of_mou
);
router.post(
  "/sell/co-helper",
  coHelperController.post_coHelper
);
router.post(
  "/sell/notify-co-helper",
  coHelperController.post_coHelperNotification
);

router.delete(
  "/sell/support-chat-notifications/:id",
  eshopController.delete_supportChatNotifications
);
router.delete(
  "/sell/member-relation/:id/:access_token",
  eshopController.delete_memberRelation
);
router.put(
  "/sell/shop-review/:id/:visible",
  eshopController.disable_shop_review
);

module.exports = router;
