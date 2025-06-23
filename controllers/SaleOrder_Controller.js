const { createDbPool } = require("../db_config/db");
const ambarsariyaPool = createDbPool();

const post_saleOrder = async (req, res) => {
  const { data } = req.body;
  console.log(data);

  try {
    await ambarsariyaPool.query("BEGIN"); // Start transaction

    // Step 1: Insert or update into Sell.sale_order
    const productQuery = `
      INSERT INTO Sell.sale_order (
        po_no, 
        buyer_id, 
        buyer_type, 
        order_date, 
        products, 
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
        prepaid, postpaid, 
        balance_credit, 
        balance_credit_due_date, 
        after_due_date_surcharges_per_day,
        status, 
        send_qr_upi_bank_details, 
        seller_id, 
        coupon_cost,
        buyer_shop_no,
        buyer_merchant_id,
        seller_member_id,
        seller_merchant_id,
        payment_status,
        buyer_name,
        buyer_phone_no,
        sector,
        category
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35
      )
      ON CONFLICT (po_no) DO UPDATE SET
        products = EXCLUDED.products,
        subtotal = EXCLUDED.subtotal,
        taxes = EXCLUDED.taxes,
        discounts = EXCLUDED.discounts,
        shipping_method = EXCLUDED.shipping_method,
        shipping_charges = EXCLUDED.shipping_charges,
        expected_delivery_date = EXCLUDED.expected_delivery_date,
        co_helper = EXCLUDED.co_helper,
        subscription_type = EXCLUDED.subscription_type,
        payment_terms = EXCLUDED.payment_terms,
        total_payment_with_all_services = EXCLUDED.total_payment_with_all_services,
        payment_method = EXCLUDED.payment_method,
        payment_due_date = EXCLUDED.payment_due_date,
        prepaid = EXCLUDED.prepaid,
        postpaid = EXCLUDED.postpaid,
        balance_credit = EXCLUDED.balance_credit,
        balance_credit_due_date = EXCLUDED.balance_credit_due_date,
        after_due_date_surcharges_per_day = EXCLUDED.after_due_date_surcharges_per_day,
        status = EXCLUDED.status,
        send_qr_upi_bank_details = EXCLUDED.send_qr_upi_bank_details,
        coupon_cost = EXCLUDED.coupon_cost,
        updated_at = CURRENT_TIMESTAMP,
        buyer_shop_no = EXCLUDED.buyer_shop_no,
        buyer_merchant_id = EXCLUDED.buyer_merchant_id,
        seller_member_id = EXCLUDED.seller_member_id,
        seller_merchant_id = EXCLUDED.seller_merchant_id,
        payment_status = EXCLUDED.payment_status,
        buyer_name = EXCLUDED.buyer_name,
        buyer_phone_no = EXCLUDED.buyer_phone_no,
        sector = EXCLUDED.sector,
        category = EXCLUDED.category
      RETURNING so_access_token
    `;

    const purchase_order = await ambarsariyaPool.query(productQuery, [
      data.po_no,
      data.buyer_id,
      data.buyer_type,
      data.order_date,
      JSON.stringify(data.products),
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
      data.status,
      data.send_qr_upi_bank_details,
      data.seller_id,
      data.coupon_cost,
      data.buyer_shop_no,
      data.buyer_merchant_id,
      data.seller_member_id,
      data.seller_merchant_id,
      data.payment_status,
      data.buyer_name,
      data.buyer_phone_no,
      data.sector,
      data.category
    ]);

    // Step 2: Update stock in Sell.items
    const stockUpdates = data.stockUpdates || [];

    for (const update of stockUpdates) {
      const { item_id, quantity_change } = update;

      await ambarsariyaPool.query(
        `
        UPDATE sell.items
        SET quantity_in_stock = quantity_in_stock - $1
        WHERE item_id = $2
        `,
        [quantity_change, item_id]
      );
    }

    // Step 3: Aggregate quantity changes by product_id
    const productStockMap = {};

    for (const update of stockUpdates) {
      const { product_id, quantity_change } = update;

      if (!productStockMap[product_id]) {
        productStockMap[product_id] = 0;
      }

      productStockMap[product_id] += quantity_change;
    }

    console.log(productStockMap);

    // Step 4: Update quantity_in_stock in sell.products
    for (const [productId, totalChange] of Object.entries(productStockMap)) {
      if (totalChange !== 0) {
        await ambarsariyaPool.query(
          `UPDATE sell.products
          SET quantity_in_stock = quantity_in_stock - $1
          WHERE product_id = $2`,
          [totalChange, productId]
        );
      }
    }

    await ambarsariyaPool.query("COMMIT"); // Commit transaction

    const so_access_token = purchase_order.rows[0].so_access_token;

    res.status(201).json({
      message: "Sale order processed successfully",
      so_access_token,
    });
  } catch (err) {
    await ambarsariyaPool.query("ROLLBACK"); // Rollback on error
    console.error("Error processing sale order:", err);
    res.status(500).json({
      error: "Error processing sale order",
      message: err.message,
    });
  }
};

const get_sale_order_numbers = async (req, res) => {
  const { seller_id } = req.params;

  try {
    if (seller_id) {
      let query = `SELECT so_no FROM sell.sale_order WHERE seller_id = $1 `;
      let result = await ambarsariyaPool.query(query, [seller_id]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the shop_no is invalid
        res.json({ valid: false, message: "No sale order exists." });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ e: "Failed to fetch data" });
  }
};

const get_sale_orders = async (req, res) => {
  const { seller_id } = req.params;

  try {
    if (seller_id) {
      let query = `SELECT so.*, s.service 
FROM sell.sale_order so  
LEFT JOIN type_of_services s ON s.id = so.shipping_method  
WHERE so.seller_id = $1 `;
      let result = await ambarsariyaPool.query(query, [seller_id]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the shop_no is invalid
        res.json({ valid: false, message: "No sale order exists." });
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
  get_sale_order_numbers,
  get_sale_orders,
};
