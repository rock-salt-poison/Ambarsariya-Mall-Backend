const { createDbPool } = require("../../../db_config/db");
const ambarsariyaPool = createDbPool();


const get_customer_records = async (req, res) => {
  const { start_date, end_date, shop_no } = req.params;

  try {
    if (start_date && end_date && shop_no) {
      console.log(start_date, end_date, shop_no);
      
      let query = `
            SELECT DISTINCT ON (buyer_id) 
                p.po_no, 
                p.buyer_id,
                p.seller_id, 
                p.shipping_address,
                COALESCE(p.buyer_name, u.full_name) as buyer_name,
                COALESCE(p.buyer_contact_no, u.phone_no_1) as buyer_contact_no
            FROM sell.purchase_order p
            left join sell.member_profiles mp 
            on mp.member_id = p.buyer_id
            left join sell.users u 
            on u.user_id = mp.user_id
            WHERE p.seller_id = $3
            AND DATE(p.created_at) BETWEEN $1 AND $2
            ORDER BY p.buyer_id, p.created_at DESC`;
      let result = await ambarsariyaPool.query(query, [start_date, end_date, shop_no]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the shop_no is invalid
        res
          .json({ valid: false, message: `No data found in the selected purchase date range.` });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ e: "Failed to fetch data" });
  }
};

const get_completed_orders = async (req, res) => {
  const { start_date, end_date, shop_no, buyer_id } = req.params;

  try {
    if (start_date && end_date && shop_no && buyer_id) {
      console.log(start_date, end_date, shop_no, buyer_id);
      
      let query = `
            SELECT *
            FROM sell.invoice_order
            WHERE DATE(created_at) BETWEEN $1 AND $2 
            AND seller_id = $3 
            AND buyer_id = $4
            ORDER BY created_at DESC`;
      let result = await ambarsariyaPool.query(query, [start_date, end_date, shop_no, buyer_id]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the shop_no is invalid
        res
          .json({ valid: false, message: `No data found in the selected purchase date range.` });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ e: "Failed to fetch data" });
  }
};

const get_pending_orders = async (req, res) => {
  const { start_date, end_date, shop_no, buyer_id } = req.params;

  try {
    if (start_date && end_date && shop_no && buyer_id) {
      console.log(start_date, end_date, shop_no, buyer_id);
      
      let query = `
           SELECT *
            FROM sell.sale_order
            WHERE DATE(created_at) BETWEEN $1 AND $2 
            AND seller_id = $3 
            AND buyer_id = $4
            AND status IS NULL
            ORDER BY created_at DESC`;
      let result = await ambarsariyaPool.query(query, [start_date, end_date, shop_no, buyer_id]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the shop_no is invalid
        res
          .json({ valid: false, message: `No data found in the selected purchase date range.` });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ e: "Failed to fetch data" });
  }
};

const get_last_purchased_total = async (req, res) => {
  const { shop_no, buyer_id } = req.params;

  try {
    if (shop_no && buyer_id) {
      console.log(shop_no, buyer_id);
      
      let query = `
           SELECT SUM(total_amount) AS total_purchased
            FROM sell.invoice_order
            WHERE seller_id = $1
              AND buyer_id =$2`;
      let result = await ambarsariyaPool.query(query, [shop_no, buyer_id]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the shop_no is invalid
        res
          .json({ valid: false, message: `Purchaser does not exists.` });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ e: "Not purchased anything before" });
  }
};

// Get supplier shops for CRM (shops/merchants based on selected domains, sectors and categories)
// Query params:
//  - domain_ids: JSON-stringified array of domain ids (required)
//  - sector_ids: JSON-stringified array of sector ids (required)
//  - category_ids: JSON-stringified array of category ids (required)
const get_supplier_shops = async (req, res) => {
  const { domain_ids, sector_ids, category_ids } = req.query;

  try {
    // Validate required parameters
    if (!domain_ids || !sector_ids || !category_ids) {
      return res
        .status(400)
        .json({ 
          valid: false, 
          message: "domain_ids, sector_ids, and category_ids are required." 
        });
    }

    // Parse JSON arrays
    let parsedDomainIds, parsedSectorIds, parsedCategoryIds;
    try {
      parsedDomainIds = JSON.parse(domain_ids);
      parsedSectorIds = JSON.parse(sector_ids);
      parsedCategoryIds = JSON.parse(category_ids);
    } catch (parseError) {
      return res
        .status(400)
        .json({ 
          valid: false, 
          message: "Invalid JSON format for domain_ids, sector_ids, or category_ids." 
        });
    }

    // Ensure arrays are not empty
    if (!Array.isArray(parsedDomainIds) || parsedDomainIds.length === 0 ||
        !Array.isArray(parsedSectorIds) || parsedSectorIds.length === 0 ||
        !Array.isArray(parsedCategoryIds) || parsedCategoryIds.length === 0) {
      return res
        .status(400)
        .json({ 
          valid: false, 
          message: "domain_ids, sector_ids, and category_ids must be non-empty arrays." 
        });
    }

    // Find shops matching any of the selected domains, sectors, and at least one matching category
    const query = `
      SELECT 
        ef.shop_no,
        ef.business_name,
        u.phone_no_1,
        u.full_name,
        CASE 
          WHEN ef.is_merchant = true THEN 'merchant'
          ELSE 'shop'
        END AS user_type,
        d.domain_name,
        s.sector_name,
        ARRAY(
          SELECT c.category_name
          FROM categories c
          WHERE c.category_id = ANY(ef.category)
          LIMIT 3
        ) AS category_name,
        ARRAY(
          SELECT p.product_name
          FROM sell.products p
          WHERE p.shop_no = ef.shop_no
          ORDER BY p.product_name
          LIMIT 3
        ) AS product_names
      FROM sell.eshop_form ef
      JOIN sell.users u ON u.user_id = ef.user_id
      LEFT JOIN domains d ON d.domain_id = ef.domain
      LEFT JOIN sectors s ON s.sector_id = ef.sector
      WHERE ef.shop_no IS NOT NULL
        AND ef.domain = ANY($1::int[])
        AND ef.sector = ANY($2::int[])
        AND ef.category && $3::int[]
      ORDER BY ef.business_name
    `;

    const result = await ambarsariyaPool.query(query, [
      parsedDomainIds,
      parsedSectorIds,
      parsedCategoryIds,
    ]);

    if (result.rows.length === 0) {
      return res.json({
        valid: false,
        message: "No supplier shops found for selected domain/sector/category.",
        data: [],
      });
    }

    return res.json({
      valid: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching supplier shops (CRM):", error);
    return res.status(500).json({
      valid: false,
      message: "Internal server error while fetching supplier shops.",
      error: error.message,
    });
  }
};


module.exports = { 
  get_customer_records,
  get_completed_orders,
  get_pending_orders,
  get_last_purchased_total,
  get_supplier_shops,
};
