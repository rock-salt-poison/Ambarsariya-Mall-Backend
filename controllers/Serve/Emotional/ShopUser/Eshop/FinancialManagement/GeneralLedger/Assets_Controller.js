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

// Get accounts receivable data for a shop and customer
const get_accounts_receivable_data = async (req, res) => {
  const { shop_no, customer_id } = req.query;

  if (!shop_no) {
    return res.status(400).json({ message: "Shop number is required." });
  }

  try {
    let query;
    let params;

    if (customer_id) {
      // Get specific customer's data
      query = `
        SELECT 
          id,
          shop_no,
          customer_id,
          customer_type,
          digilocker_auth_level,
          company_loan_postpaid,
          total_credit_given,
          outstanding_balance,
          last_settlement_date,
          created_at,
          updated_at
        FROM serve_financial_management.assets_accounts_receivable
        WHERE shop_no = $1 AND customer_id = $2
      `;
      params = [shop_no, customer_id];
    } else {
      // Get all customers for the shop
      query = `
        SELECT 
          id,
          shop_no,
          customer_id,
          customer_type,
          digilocker_auth_level,
          company_loan_postpaid,
          total_credit_given,
          outstanding_balance,
          last_settlement_date,
          created_at,
          updated_at
        FROM serve_financial_management.assets_accounts_receivable
        WHERE shop_no = $1
        ORDER BY updated_at DESC
      `;
      params = [shop_no];
    }

    const result = await ambarsariyaPool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(200).json({ 
        exists: false, 
        message: customer_id ? "No accounts receivable data found for this customer." : "No accounts receivable data found for this shop.",
        data: customer_id ? null : []
      });
    }

    return res.status(200).json({ 
      exists: true, 
      message: "Accounts receivable data retrieved successfully.",
      data: customer_id ? result.rows[0] : result.rows
    });
  } catch (error) {
    console.error("Error fetching accounts receivable data:", error);
    return res.status(500).json({ 
      message: "Internal server error.", 
      error: error.message 
    });
  }
};

// Get members and vendors list for dropdown
const get_customers_list = async (req, res) => {
  const { shop_no } = req.query;

  if (!shop_no) {
    return res.status(400).json({ message: "Shop number is required." });
  }

  try {
    // Get members
    const membersQuery = `
      SELECT 
        m.member_id as id,
        m.member_id as customer_id,
        'Member' as customer_type,
        u.full_name as name,
        u.phone_no_1 as phone
      FROM sell.member_profiles m
      JOIN sell.users u ON u.user_id = m.user_id
      WHERE m.member_id IS NOT NULL
      ORDER BY u.full_name
    `;

    // Get vendors/merchants (shops)
    const vendorsQuery = `
      SELECT 
        ef.shop_no as id,
        ef.shop_no as customer_id,
        'Vendor' as customer_type,
        ef.business_name as name,
        u.phone_no_1 as phone
      FROM sell.eshop_form ef
      JOIN sell.users u ON u.user_id = ef.user_id
      WHERE ef.shop_no != $1 AND ef.shop_no IS NOT NULL
      ORDER BY ef.business_name
    `;

    const [membersResult, vendorsResult] = await Promise.all([
      ambarsariyaPool.query(membersQuery),
      ambarsariyaPool.query(vendorsQuery, [shop_no])
    ]);

    const customers = [
      ...membersResult.rows.map(row => ({
        id: row.customer_id,
        customer_id: row.customer_id,
        customer_type: row.customer_type,
        label: `${row.name} (${row.customer_id}) - ${row.customer_type}`,
        name: row.name,
        phone: row.phone
      })),
      ...vendorsResult.rows.map(row => ({
        id: row.customer_id,
        customer_id: row.customer_id,
        customer_type: row.customer_type,
        label: `${row.name} (${row.customer_id}) - ${row.customer_type}`,
        name: row.name,
        phone: row.phone
      }))
    ];

    return res.status(200).json({
      valid: true,
      data: customers
    });
  } catch (error) {
    console.error("Error fetching customers list:", error);
    return res.status(500).json({
      message: "Internal server error.",
      error: error.message
    });
  }
};

// Save or update accounts receivable data
const post_accounts_receivable_data = async (req, res) => {
  const {
    shop_no,
    customer_id,
    customer_type,
    digilocker_auth_level,
    company_loan_postpaid,
    total_credit_given,
    outstanding_balance,
    last_settlement_date,
  } = req.body;

  if (!shop_no || !customer_id || !customer_type) {
    return res.status(400).json({ 
      message: "Shop number, customer ID, and customer type are required." 
    });
  }

  // Validate customer_type
  if (!['Member', 'Merchant', 'Vendor'].includes(customer_type)) {
    return res.status(400).json({ 
      message: "Invalid customer type. Must be 'Member', 'Merchant', or 'Vendor'." 
    });
  }

  try {
    // Check if data already exists (using unique constraint on shop_no, customer_id)
    const checkQuery = `
      SELECT id FROM serve_financial_management.assets_accounts_receivable 
      WHERE shop_no = $1 AND customer_id = $2
    `;
    const checkResult = await ambarsariyaPool.query(checkQuery, [shop_no, customer_id]);

    if (checkResult.rows.length > 0) {
      // Update existing record
      const updateQuery = `
        UPDATE serve_financial_management.assets_accounts_receivable
        SET 
          customer_type = $3,
          digilocker_auth_level = $4,
          company_loan_postpaid = $5,
          total_credit_given = $6,
          outstanding_balance = $7,
          last_settlement_date = $8,
          updated_at = now()
        WHERE shop_no = $1 AND customer_id = $2
        RETURNING *
      `;

      const updateResult = await ambarsariyaPool.query(updateQuery, [
        shop_no,
        customer_id,
        customer_type,
        digilocker_auth_level ? parseInt(digilocker_auth_level) : 0,
        company_loan_postpaid ? parseInt(company_loan_postpaid) : 0,
        total_credit_given ? parseInt(total_credit_given) : 0,
        outstanding_balance ? parseInt(outstanding_balance) : 0,
        last_settlement_date || null,
      ]);

      return res.status(200).json({
        message: "Accounts receivable data updated successfully.",
        data: updateResult.rows[0],
      });
    } else {
      // Insert new record
      const insertQuery = `
        INSERT INTO serve_financial_management.assets_accounts_receivable (
          shop_no,
          customer_id,
          customer_type,
          digilocker_auth_level,
          company_loan_postpaid,
          total_credit_given,
          outstanding_balance,
          last_settlement_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const insertResult = await ambarsariyaPool.query(insertQuery, [
        shop_no,
        customer_id,
        customer_type,
        digilocker_auth_level ? parseInt(digilocker_auth_level) : 0,
        company_loan_postpaid ? parseInt(company_loan_postpaid) : 0,
        total_credit_given ? parseInt(total_credit_given) : 0,
        outstanding_balance ? parseInt(outstanding_balance) : 0,
        last_settlement_date || null,
      ]);

      return res.status(201).json({
        message: "Accounts receivable data saved successfully.",
        data: insertResult.rows[0],
      });
    }
  } catch (error) {
    console.error("Error saving accounts receivable data:", error);
    return res.status(500).json({
      message: "Internal server error.",
      error: error.message,
    });
  }
};

// Get fixed assets data for a shop
const get_fixed_assets_data = async (req, res) => {
  const { shop_no } = req.params;

  if (!shop_no) {
    return res.status(400).json({ message: "Shop number is required." });
  }

  try {
    const query = `
      SELECT 
        id,
        shop_no,
        length_cm,
        breadth_cm,
        height_cm,
        sku_rack_no,
        sku_shelf_no,
        rack_total_cost,
        asset_name,
        size_specification,
        condition,
        cost,
        purchase_date,
        change_required_date,
        days_left,
        created_at,
        updated_at
      FROM serve_financial_management.assets_fixed_assets
      WHERE shop_no = $1
      ORDER BY updated_at DESC
    `;

    const result = await ambarsariyaPool.query(query, [shop_no]);

    if (result.rows.length === 0) {
      return res.status(200).json({ 
        exists: false, 
        message: "No fixed assets data found for this shop.",
        data: []
      });
    }

    return res.status(200).json({ 
      exists: true, 
      message: "Fixed assets data retrieved successfully.",
      data: result.rows
    });
  } catch (error) {
    console.error("Error fetching fixed assets data:", error);
    return res.status(500).json({ 
      message: "Internal server error.", 
      error: error.message 
    });
  }
};

// Save or update fixed assets data
const post_fixed_assets_data = async (req, res) => {
  const {
    shop_no,
    length_cm,
    breadth_cm,
    height_cm,
    sku_rack_no,
    sku_shelf_no,
    rack_total_cost,
    asset_name,
    size_specification,
    condition,
    cost,
    purchase_date,
    change_required_date,
    days_left,
  } = req.body;

  if (!shop_no) {
    return res.status(400).json({ message: "Shop number is required." });
  }

  if (!length_cm || length_cm <= 0 || !breadth_cm || breadth_cm <= 0 || !height_cm || height_cm <= 0) {
    return res.status(400).json({ message: "Length, breadth, and height are required and must be greater than 0." });
  }

  if (!asset_name || !condition || !cost || cost < 0 || !purchase_date) {
    return res.status(400).json({ message: "Asset name, condition, cost (>= 0), and purchase date are required." });
  }

  // Validate condition
  const validConditions = ['New', 'Working', 'Not Working', 'Change Required', 'Old'];
  if (!validConditions.includes(condition)) {
    return res.status(400).json({ message: "Invalid condition value." });
  }

  try {
    // Insert new record (multiple records allowed per shop)
    const insertQuery = `
      INSERT INTO serve_financial_management.assets_fixed_assets (
        shop_no,
        length_cm,
        breadth_cm,
        height_cm,
        sku_rack_no,
        sku_shelf_no,
        rack_total_cost,
        asset_name,
        size_specification,
        condition,
        cost,
        purchase_date,
        change_required_date,
        days_left
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const insertResult = await ambarsariyaPool.query(insertQuery, [
      shop_no,
      parseInt(length_cm) || 0,
      parseInt(breadth_cm) || 0,
      parseInt(height_cm) || 0,
      sku_rack_no ? parseInt(sku_rack_no) : 0,
      sku_shelf_no ? parseInt(sku_shelf_no) : 0,
      rack_total_cost ? parseInt(rack_total_cost) : 0,
      asset_name,
      size_specification || null,
      condition,
      parseInt(cost) || 0,
      purchase_date,
      change_required_date || null,
      days_left ? parseInt(days_left) : null,
    ]);

    return res.status(201).json({
      message: "Fixed assets data saved successfully.",
      data: insertResult.rows[0],
    });
  } catch (error) {
    console.error("Error saving fixed assets data:", error);
    return res.status(500).json({
      message: "Internal server error.",
      error: error.message,
    });
  }
};

// Get all shops excluding current shop with same domain, sector, and category
const get_supplier_shops = async (req, res) => {
  const { shop_no, domain_id, sector_id, category_ids } = req.query;

  if (!shop_no) {
    return res.status(400).json({ message: "Shop number is required." });
  }

  try {
    // First, get current shop's domain, sector, and category if not provided
    let currentShopDomain, currentShopSector, currentShopCategories;
    
    if (!domain_id || !sector_id || !category_ids) {
      const currentShopQuery = `
        SELECT domain, sector, category
        FROM sell.eshop_form
        WHERE shop_no = $1
      `;
      const currentShopResult = await ambarsariyaPool.query(currentShopQuery, [shop_no]);
      
      if (currentShopResult.rows.length === 0) {
        return res.status(404).json({ message: "Current shop not found." });
      }
      
      currentShopDomain = domain_id || currentShopResult.rows[0].domain;
      currentShopSector = sector_id || currentShopResult.rows[0].sector;
      currentShopCategories = category_ids ? JSON.parse(category_ids) : (currentShopResult.rows[0].category || []);
    } else {
      currentShopDomain = parseInt(domain_id);
      currentShopSector = parseInt(sector_id);
      currentShopCategories = JSON.parse(category_ids);
    }

    // Build query to find shops with same domain, sector, and at least one matching category
    const query = `
      SELECT DISTINCT
        ef.shop_no,
        ef.business_name,
        u.phone_no_1,
        u.full_name
      FROM sell.eshop_form ef
      JOIN sell.users u ON u.user_id = ef.user_id
      WHERE ef.shop_no != $1 
        AND ef.shop_no IS NOT NULL
        AND ef.domain = $2
        AND ef.sector = $3
        AND ef.category && $4::bigint[]
      ORDER BY ef.business_name
    `;

    const result = await ambarsariyaPool.query(query, [
      shop_no,
      currentShopDomain,
      currentShopSector,
      currentShopCategories
    ]);

    return res.status(200).json({
      valid: true,
      data: result.rows.map(row => ({
        shop_no: row.shop_no,
        label: `${row.business_name} (${row.shop_no})`,
        business_name: row.business_name,
        phone: row.phone_no_1
      }))
    });
  } catch (error) {
    console.error("Error fetching supplier shops:", error);
    return res.status(500).json({
      message: "Internal server error.",
      error: error.message
    });
  }
};

// Get accounts payable data for a shop
const get_accounts_payable_data = async (req, res) => {
  const { shop_no } = req.params;

  if (!shop_no) {
    return res.status(400).json({ message: "Shop number is required." });
  }

  try {
    const query = `
      SELECT 
        id,
        shop_no,
        supplier_shop_no,
        category_id,
        product_id,
        item_id,
        quantity,
        total_items,
        total_cost,
        advance_payment,
        balance,
        from_date,
        to_date,
        created_at,
        updated_at
      FROM serve_financial_management.assets_accounts_payable
      WHERE shop_no = $1
      ORDER BY updated_at DESC
    `;

    const result = await ambarsariyaPool.query(query, [shop_no]);

    if (result.rows.length === 0) {
      return res.status(200).json({ 
        exists: false, 
        message: "No accounts payable data found for this shop.",
        data: []
      });
    }

    return res.status(200).json({ 
      exists: true, 
      message: "Accounts payable data retrieved successfully.",
      data: result.rows
    });
  } catch (error) {
    console.error("Error fetching accounts payable data:", error);
    return res.status(500).json({ 
      message: "Internal server error.", 
      error: error.message 
    });
  }
};

// Save accounts payable data
const post_accounts_payable_data = async (req, res) => {
  const {
    shop_no,
    supplier_shop_no,
    category_id,
    product_id,
    item_id,
    quantity,
    total_items,
    total_cost,
    advance_payment,
    from_date,
    to_date,
  } = req.body;

  if (!shop_no || !supplier_shop_no || !category_id || !product_id || !item_id) {
    return res.status(400).json({ 
      message: "Shop number, supplier shop number, category, product, and item are required." 
    });
  }

  if (!quantity || quantity <= 0) {
    return res.status(400).json({ message: "Quantity must be greater than 0." });
  }

  if (total_items < 0 || total_cost < 0 || advance_payment < 0) {
    return res.status(400).json({ 
      message: "Total items, total cost, and advance payment must be non-negative." 
    });
  }

  try {
    // Insert new record
    const insertQuery = `
      INSERT INTO serve_financial_management.assets_accounts_payable (
        shop_no,
        supplier_shop_no,
        category_id,
        product_id,
        item_id,
        quantity,
        total_items,
        total_cost,
        advance_payment,
        from_date,
        to_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const insertResult = await ambarsariyaPool.query(insertQuery, [
      shop_no,
      supplier_shop_no,
      parseInt(category_id),
      product_id,
      item_id,
      parseInt(quantity),
      total_items ? parseInt(total_items) : 0,
      total_cost ? parseInt(total_cost) : 0,
      advance_payment ? parseInt(advance_payment) : 0,
      from_date || null,
      to_date || null,
    ]);

    return res.status(201).json({
      message: "Accounts payable data saved successfully.",
      data: insertResult.rows[0],
    });
  } catch (error) {
    console.error("Error saving accounts payable data:", error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(400).json({
        message: "A record with the same shop, supplier, item, and date already exists.",
        error: error.message
      });
    }

    return res.status(500).json({
      message: "Internal server error.",
      error: error.message,
    });
  }
};

module.exports = {
  get_cash_data,
  post_cash_data,
  get_accounts_receivable_data,
  get_customers_list,
  post_accounts_receivable_data,
  get_fixed_assets_data,
  post_fixed_assets_data,
  get_supplier_shops,
  get_accounts_payable_data,
  post_accounts_payable_data,
};
