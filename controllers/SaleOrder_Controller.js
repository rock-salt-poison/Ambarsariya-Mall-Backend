const { createDbPool } = require("../db_config/db");
const ambarsariyaPool = createDbPool();

const post_saleOrder = async (req, res) => {
  const { data } = req.body;
  console.log(data);

  try {
    await ambarsariyaPool.query("BEGIN"); // Start a transaction

    // Insert the product data
    const productQuery = `
      INSERT INTO Sell.sale_order (
        po_no,
        buyer_id,
        buyer_type,
        order_date,
        product_id,
        quantity,
        unit_price,
        line_total_no_of_items,
        subtotal,
        taxes,
        discounts,
        shipping_method,
        shipping_charges,
        expected_delivery_date,
        co_helper,
        subscription_type,
        payment_terms,
        total_payment_with_all_services,
        payment_method,
        payment_due_date,
        prepaid,
        postpaid,
        balance_credit,
        balance_credit_due_date,
        after_due_date_surcharges_per_day,
        accept_or_deny,
        send_qr_upi_bank_details
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 
        $19, $20, $21, $22, $23, $24, $25, $26, $27
      ) 
      RETURNING so_access_token
    `;

    const purchase_order = await ambarsariyaPool.query(productQuery, [
      data.po_no,
      data.buyer_id,
      data.buyer_type,
      data.order_date,
      data.product_id,
      data.quantity,
      data.unit_price,
      data.line_total_no_of_items,
      data.subtotal,
      data.taxes,
      data.discounts,
      data.shipping_method,
      data.shipping_charges,
      data.expected_delivery_date,
      data.co_helper,
      JSON.stringify(data.subscription_type),
      data.payment_terms,
      data.total_payment_with_all_services,
      data.payment_method,
      data.payment_due_date,
      data.prepaid,
      data.postpaid,
      data.balance_credit,
      data.balance_credit_due_date,
      data.after_due_date_surcharges_per_day,
      data.accept_or_deny,
      data.send_qr_upi_bank_details
    ]);

    const so_access_token = purchase_order.rows[0].so_access_token;

    await ambarsariyaPool.query("COMMIT"); // Commit transaction if all goes well
    res
      .status(201)
      .json({
        message: "Sale order created successfully",
        so_access_token,
      });
  } catch (err) {
    await ambarsariyaPool.query("ROLLBACK"); // Rollback transaction in case of error
    console.error("Error inserting sale order:", err);
    res
      .status(500)
      .json({ error: "Error creating sale order", message: err.message });
  }
};

const get_purchase_orders = async (req, res) => {
  const { seller_id } = req.params;

  try {
    if (seller_id) {
      let query = `SELECT 
    po.po_no, 
    po.buyer_id, 
    po.buyer_type, 
    po.seller_id, 
    po.buyer_gst_number, 
    po.seller_gst_number, 
    product->>'no' AS product_no, 
    (product->>'quantity')::int AS quantity_ordered, 
    (product->>'unit_price')::numeric AS unit_price, 
    product->>'description' AS description, 
    (product->>'total_price')::numeric AS total_price,
    pr.inventory_or_stock_quantity AS quantity,  -- Available product quantity
    pr.product_name,  
    pr.variant_group,
    po.subtotal, 
    po.shipping_address, 
    po.shipping_method, 
    po.payment_method, 
    po.special_offers, 
    po.discount_applied, 
    po.taxes, 
    po.co_helper, 
    -- Distribute discount_amount equally across products and round to 2 decimal places
    ROUND((po.discount_amount / NULLIF(
        (SELECT COUNT(*) 
         FROM jsonb_array_elements(po.products::jsonb) AS p), 0
    )), 2) AS discount_amount,
    po.pre_post_paid, 
    po.extra_charges, 
    po.total_amount, 
    po.date_of_issue, 
    po.delivery_terms, 
    po.additional_instructions, 
    po.po_access_token,
    ARRAY[pr.variation_1, pr.variation_2, pr.variation_3, pr.variation_4] AS variations

FROM sell.purchase_order po
CROSS JOIN LATERAL jsonb_array_elements(po.products::jsonb) AS product
LEFT JOIN sell.products pr 
    ON po.seller_id = pr.shop_no  
    AND product->>'no' = pr.product_id  
WHERE po.seller_id = $1`;
      let result = await ambarsariyaPool.query(query, [seller_id]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the shop_no is invalid
        res
          .status(404)
          .json({ valid: false, message: "No purchase order exists." });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ e: "Failed to fetch data" });
  }
};

const get_purchase_order_details = async (req, res) => {
  const { po_access_token } = req.params;

  try {
    if (po_access_token) {
      let query = `SELECT * FROM sell.purchase_order WHERE po_access_token = $1`;
      let result = await ambarsariyaPool.query(query, [po_access_token]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the shop_no is invalid
        res
          .status(404)
          .json({ valid: false, message: "No purchase order exists." });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ e: "Failed to fetch data" });
  }
};

module.exports = {
  post_saleOrder,
  get_purchase_orders,
  get_purchase_order_details,
};
