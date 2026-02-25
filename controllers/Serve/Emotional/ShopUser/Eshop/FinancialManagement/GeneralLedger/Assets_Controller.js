const { createDbPool } = require("../../../../../../../db_config/db");
const ambarsariyaPool = createDbPool();

// Get cash data for a shop
const get_cash_data = async (req, res) => {
  const { shop_no } = req.params;

  if (!shop_no) {
    return res.status(400).json({ message: "Shop number is required." });
  }

  try {
    const query = `
      SELECT 
        shop_no,
        name,
        bank_name,
        bank_ifsc_code,
        bank_address,
        bank_account_number,
        upi_linked_services,
        bank_cash_available,
        bank_limit_available,
        other_credits_available,
        cash_available_in_counter,
        cash_available_in_wallets,
        created_at,
        updated_at
      FROM serve_financial_management.assets_cash
      WHERE shop_no = $1
    `;

    const result = await ambarsariyaPool.query(query, [shop_no]);

    if (result.rows.length === 0) {
      return res.status(200).json({ 
        exists: false, 
        message: "No cash data found for this shop.",
        data: null 
      });
    }

    return res.status(200).json({ 
      exists: true, 
      message: "Cash data retrieved successfully.",
      data: result.rows[0] 
    });
  } catch (error) {
    console.error("Error fetching cash data:", error);
    return res.status(500).json({ 
      message: "Internal server error.", 
      error: error.message 
    });
  }
};

// Save or update cash data for a shop
const post_cash_data = async (req, res) => {
  const {
    shop_no,
    name,
    bank_name,
    bank_ifsc_code,
    bank_address,
    bank_account_number,
    upi_linked_services,
    bank_cash_available,
    bank_limit_available,
    other_credits_available,
    cash_available_in_counter,
    cash_available_in_wallets,
  } = req.body;

  if (!shop_no) {
    return res.status(400).json({ message: "Shop number is required." });
  }

  try {
    // Check if data already exists
    const checkQuery = `
      SELECT shop_no FROM serve_financial_management.assets_cash WHERE shop_no = $1
    `;
    const checkResult = await ambarsariyaPool.query(checkQuery, [shop_no]);

    if (checkResult.rows.length > 0) {
      // Update existing record
      const updateQuery = `
        UPDATE serve_financial_management.assets_cash
        SET 
          name = $2,
          bank_name = $3,
          bank_ifsc_code = $4,
          bank_address = $5,
          bank_account_number = $6,
          upi_linked_services = $7,
          bank_cash_available = $8,
          bank_limit_available = $9,
          other_credits_available = $10,
          cash_available_in_counter = $11,
          cash_available_in_wallets = $12,
          updated_at = now()
        WHERE shop_no = $1
        RETURNING *
      `;

      const updateResult = await ambarsariyaPool.query(updateQuery, [
        shop_no,
        name || null,
        bank_name || null,
        bank_ifsc_code || null,
        bank_address || null,
        bank_account_number || null,
        upi_linked_services || null,
        bank_cash_available ? parseInt(bank_cash_available) : 0,
        bank_limit_available ? parseInt(bank_limit_available) : 0,
        other_credits_available ? parseInt(other_credits_available) : 0,
        cash_available_in_counter ? parseInt(cash_available_in_counter) : 0,
        cash_available_in_wallets ? parseInt(cash_available_in_wallets) : 0,
      ]);

      return res.status(200).json({
        message: "Cash data updated successfully.",
        data: updateResult.rows[0],
      });
    } else {
      // Insert new record
      const insertQuery = `
        INSERT INTO serve_financial_management.assets_cash (
          shop_no,
          name,
          bank_name,
          bank_ifsc_code,
          bank_address,
          bank_account_number,
          upi_linked_services,
          bank_cash_available,
          bank_limit_available,
          other_credits_available,
          cash_available_in_counter,
          cash_available_in_wallets
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const insertResult = await ambarsariyaPool.query(insertQuery, [
        shop_no,
        name || null,
        bank_name || null,
        bank_ifsc_code || null,
        bank_address || null,
        bank_account_number || null,
        upi_linked_services || null,
        bank_cash_available ? parseInt(bank_cash_available) : 0,
        bank_limit_available ? parseInt(bank_limit_available) : 0,
        other_credits_available ? parseInt(other_credits_available) : 0,
        cash_available_in_counter ? parseInt(cash_available_in_counter) : 0,
        cash_available_in_wallets ? parseInt(cash_available_in_wallets) : 0,
      ]);

      return res.status(201).json({
        message: "Cash data saved successfully.",
        data: insertResult.rows[0],
      });
    }
  } catch (error) {
    console.error("Error saving cash data:", error);
    return res.status(500).json({
      message: "Internal server error.",
      error: error.message,
    });
  }
};

module.exports = {
  get_cash_data,
  post_cash_data,
};
