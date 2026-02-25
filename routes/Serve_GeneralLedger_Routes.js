const express = require("express");
const router = express.Router();
const AssetsController = require("../controllers/Serve/Emotional/ShopUser/Eshop/FinancialManagement/GeneralLedger/Assets_Controller");

// General Ledger routes
router.get("/cash/:shop_no", AssetsController.get_cash_data);


router.post("/cash", AssetsController.post_cash_data);

module.exports = router;
