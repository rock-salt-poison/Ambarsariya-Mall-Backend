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

module.exports = { 
  get_customer_records,
  get_completed_orders,
  get_pending_orders,
  get_last_purchased_total,
};
