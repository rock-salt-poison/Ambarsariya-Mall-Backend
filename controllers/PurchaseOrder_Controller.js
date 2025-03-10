const { createDbPool } = require("../db_config/db");
const ambarsariyaPool = createDbPool();

const post_purchaseOrder = async (req, res) => {
  const { data } = req.body;
  console.log(data);

  try {
    await ambarsariyaPool.query("BEGIN"); // Start a transaction

    // Insert the product data
    const productQuery = `
      INSERT INTO Sell.purchase_order (
        buyer_id,
        buyer_type,
        seller_id,
        buyer_gst_number,
        seller_gst_number,
        products,
        subtotal,
        shipping_address,
        shipping_method,
        payment_method,
        special_offers,
        discount_applied,
        taxes,
        co_helper,
        discount_amount,
        pre_post_paid,
        extra_charges,
        total_amount,
        date_of_issue,
        delivery_terms,
        additional_instructions
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 
        $19, $20, $21
      ) 
      RETURNING po_access_token
    `;

    const purchase_order = await ambarsariyaPool.query(productQuery, [
      data.buyer_id,
      data.buyer_type,
      data.seller_id,
      data.buyer_gst_number,
      data.seller_gst_number,
      JSON.stringify(data.products),
      data.subtotal,
      data.shipping_address,
      data.shipping_method,
      data.payment_method,
      JSON.stringify(data.special_offers),
      JSON.stringify(data.discount_applied),
      data.taxes,
      data.co_helper,
      data.discount_amount,
      data.pre_post_paid,
      data.extra_charges,
      data.total_amount,
      data.date_of_issue,
      data.delivery_terms,
      data.additional_instructions,
    ]);

    const po_access_token = purchase_order.rows[0].po_access_token;

    // Update product quantity in Sell.products
    for (const product of data.products) {
      const updateQuery = `
        UPDATE Sell.products
        SET purchased_quantity = purchased_quantity + $1
        WHERE product_id = $2
      `;

      await ambarsariyaPool.query(updateQuery, [product.quantity, product.no]);
    }

    await ambarsariyaPool.query("COMMIT"); // Commit transaction if all goes well
    res
      .status(201)
      .json({
        message: "Purchase order created successfully",
        po_access_token,
      });
  } catch (err) {
    await ambarsariyaPool.query("ROLLBACK"); // Rollback transaction in case of error
    console.error("Error inserting purchase order:", err);
    res
      .status(500)
      .json({ error: "Error creating purchase order", message: err.message });
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
    po.po_access_token

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
  post_purchaseOrder,
  get_purchase_orders,
  get_purchase_order_details,
};
