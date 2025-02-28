const { createDbPool } = require("../db_config/db");
const ambarsariyaPool = createDbPool();

const post_purchaseOrder = async (req, res) => {
  const { data } = req.body;
  console.log(data);
  

  try {
    await ambarsariyaPool.query("BEGIN"); // Start a transaction
    
    // Insert the product data
    const productQuery = `INSERT INTO Sell.purchase_order (
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
      )`;

      await ambarsariyaPool.query(productQuery, [
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
        data.additional_instructions
      ]);
      await ambarsariyaPool.query("COMMIT"); // Commit transaction if all goes well
      res.status(201).json({ message: "Purchase order created successfully" });
    }

   catch (err) {
    await ambarsariyaPool.query("ROLLBACK"); // Rollback transaction in case of error
    console.error("Error inserting purchase order:", err);
    res.status(500).json({ error: "Error inserting purchase order", message:err });
  }
};



module.exports = { post_purchaseOrder };
