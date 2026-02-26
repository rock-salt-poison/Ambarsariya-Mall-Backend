const express = require("express");
const router = express.Router();
const AssetsController = require("../controllers/Serve/Emotional/ShopUser/Eshop/FinancialManagement/GeneralLedger/Assets_Controller");

// General Ledger routes
router.get("/cash/:shop_no", AssetsController.get_cash_data);
router.post("/cash", AssetsController.post_cash_data);

// Accounts Receivable routes
router.get("/accounts-receivable", AssetsController.get_accounts_receivable_data);
router.get("/customers-list", AssetsController.get_customers_list);
router.post("/accounts-receivable", AssetsController.post_accounts_receivable_data);

// Fixed Assets routes
router.get("/fixed-assets/:shop_no", AssetsController.get_fixed_assets_data);
router.post("/fixed-assets", AssetsController.post_fixed_assets_data);

// Accounts Payable routes
router.get("/supplier-shops", AssetsController.get_supplier_shops);
router.get("/accounts-payable/:shop_no", AssetsController.get_accounts_payable_data);
router.post("/accounts-payable", AssetsController.post_accounts_payable_data);

module.exports = router;
