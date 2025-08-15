const { createDbPool } = require("../db_config/db");
const ambarsariyaPool = createDbPool();

const post_purchaseOrder = async (req, res) => {
  const { data } = req.body;
  console.log(data);

  try {
    await ambarsariyaPool.query("BEGIN"); // Start transaction

    // Check stock availability for all products before proceeding
    for (const product of data.products) {
      const stockCheckQuery = `
        SELECT quantity_in_stock 
        FROM Sell.products 
        WHERE product_id = $1
      `;

      const stockResult = await ambarsariyaPool.query(stockCheckQuery, [product.id]);

      if (stockResult.rows.length === 0 || stockResult.rows[0].quantity_in_stock <= 0) {
        throw new Error(`Product ID ${product.id} is out of stock`);
      }
    }

    // Insert purchase order
    const productQuery = `
      INSERT INTO Sell.purchase_order (
        buyer_id, buyer_type, seller_id, buyer_gst_number, seller_gst_number, 
        products, subtotal, shipping_address, shipping_method, payment_method, 
        special_offers, discount_applied, taxes, co_helper, discount_amount, 
        pre_post_paid, extra_charges, total_amount, date_of_issue, 
        delivery_terms, additional_instructions, coupon_cost, buyer_name, buyer_contact_no
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 
        $17, $18, $19, $20, $21, $22, $23, $24
      ) 
      RETURNING po_access_token
    `;

    const purchase_order = await ambarsariyaPool.query(productQuery, [
      data.buyer_id, data.buyer_type, data.seller_id, data.buyer_gst_number, 
      data.seller_gst_number, JSON.stringify(data.products), data.subtotal, 
      data.shipping_address, data.shipping_method, data.payment_method, 
      JSON.stringify(data.special_offers), JSON.stringify(data.discount_applied), 
      data.taxes, data.co_helper, data.discount_amount, data.pre_post_paid, 
      data.extra_charges, data.total_amount, data.date_of_issue, 
      data.delivery_terms, data.additional_instructions, data.coupon_cost, data.buyer_name, data.buyer_contact_no
    ]);

    const po_access_token = purchase_order.rows[0].po_access_token;

    // Update product quantity in Sell.products
    for (const product of data.products) {
      // Update stock in Sell.products
      const updateProductStockQuery = `
        UPDATE Sell.products
        SET quantity_in_stock = GREATEST(quantity_in_stock - $1, 0)
        WHERE product_id = $2
        RETURNING quantity_in_stock
      `;

      const productResult = await ambarsariyaPool.query(updateProductStockQuery, [product.quantity, product.id]);

      if (productResult.rows.length === 0 || productResult.rows[0].quantity_in_stock < 0) {
        throw new Error(`Not enough product stock for product ID: ${product.id}`);
      }

      // Update stock in Sell.items (for the specific item)
      const updateItemStockQuery = `
        UPDATE Sell.items
        SET quantity_in_stock = GREATEST(quantity_in_stock - $1, 0)
        WHERE item_id = $2 AND product_id = $3
        RETURNING quantity_in_stock
      `;

      const itemResult = await ambarsariyaPool.query(updateItemStockQuery, [product.quantity,product.selectedVariant, product.id]);

      if (itemResult.rows.length === 0 || itemResult.rows[0].quantity_in_stock < 0) {
        throw new Error(`Not enough item stock for product ID: ${product.id}`);
      }

    }


    if (data?.discount_applied?.coupon_type) {
      const updateCouponQuery = `
        UPDATE Sell.discount_coupons
        SET no_of_coupons = GREATEST(no_of_coupons - 1, 0)
        WHERE coupon_type = $1 AND shop_no = $2
        RETURNING no_of_coupons
      `;

      const couponResult = await ambarsariyaPool.query(updateCouponQuery, [
        data.discount_applied.coupon_type,
        data.seller_id // assuming seller_id is the shop_no
      ]);

      if (couponResult.rowCount === 0) {
        console.log(`No matching coupon found for type: ${data.discount_applied.coupon_type} and shop_no: ${data.seller_id}`);
      }
    }

    await ambarsariyaPool.query("COMMIT"); // Commit transaction if all goes well
    res.status(201).json({
      message: "Purchase order created successfully",
      po_access_token,
    });
  } catch (err) {
    await ambarsariyaPool.query("ROLLBACK"); // Rollback transaction in case of error
    console.error("Error inserting purchase order:", err);
    res.status(400).json({ error: "Order failed", message: err.message });
  }
};


const get_purchase_orders = async (req, res) => {
  const { po_no } = req.params;
  console.log(po_no);
  
  try {
    if (po_no) {
      let query = `SELECT 
        po.po_no, 
        po.buyer_id, 
        po.buyer_type, 
        po.seller_id, 
        po.buyer_gst_number, 
        po.seller_gst_number, 
        product->>'id' AS product_id, 
        COALESCE((so_product->>'quantity')::int, (product->>'quantity')::int) AS quantity_ordered,
        COALESCE((so_product->>'unit_price')::numeric, (product->>'unit_price')::numeric) AS unit_price,
        COALESCE(so_product->>'selected_variant', product->>'selectedVariant') AS selected_variant,
        product->>'description' AS description, 
        COALESCE((so_product->>'total_price')::numeric, (product->>'total_price')::numeric) AS total_price,
        pr.max_stock_quantity AS quantity,  
        pr.product_name,  
        pr.variant_group,
        pr.quantity_in_stock,
        pr.iku_id,
        po.subtotal AS po_subtotal,
        so.subtotal AS so_subtotal, 
        po.shipping_address, 
        po.shipping_method, 
        ts.service,
        po.payment_method, 
        po.special_offers, 
        po.discount_applied, 
        po.taxes, 
        po.co_helper, 
        po.products as po_products,
        so.products as so_products,
        -- Distribute discount_amount equally across products
        ROUND((po.discount_amount / NULLIF(
            (SELECT COUNT(*) 
            FROM jsonb_array_elements(po.products::jsonb)), 0
        )), 2) AS discount_amount,

        po.discount_amount as total_discount_amount,
        po.pre_post_paid, 
        po.extra_charges, 
        po.total_amount, 
        po.date_of_issue, 
        po.delivery_terms, 
        po.additional_instructions, 
        po.po_access_token,
        ARRAY[pr.variation_1, pr.variation_2, pr.variation_3, pr.variation_4] AS variations,
        COALESCE(so_product->>'accept_or_deny', 'Hold') AS status,
        so.so_no,
        so.status AS sale_order_status,
        po.seller_id,
        ef.shop_access_token,
        po.coupon_cost,

        -- Grouped items per product as array of JSON objects
        (
            SELECT jsonb_agg(jsonb_build_object(
                'item_id', i.item_id,
                'item_quantity', i.quantity_in_stock,
                'item_selling_price', i.selling_price
            ))
            FROM sell.items i
            WHERE i.product_id = product->>'id'
        ) AS items

    FROM sell.purchase_order po
    CROSS JOIN LATERAL jsonb_array_elements(po.products::jsonb) AS product
    LEFT JOIN sell.products pr 
        ON po.seller_id = pr.shop_no  
        AND product->>'id' = pr.product_id
    LEFT JOIN sell.sale_order so
        ON po.po_no = so.po_no
    LEFT JOIN LATERAL (
        SELECT so_product
        FROM jsonb_array_elements(so.products::jsonb) AS so_product
        WHERE so_product->>'product_id' = product->>'id'
    ) so_product ON TRUE
    LEFT JOIN type_of_services ts
        ON ts.id = po.shipping_method
    LEFT JOIN sell.eshop_form ef
    ON ef.shop_no = po.seller_id 
    WHERE po.po_no = $1;
`;
      let result = await ambarsariyaPool.query(query, [po_no]);
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
    // console.error(e);
    res.status(500).json({ e: "Failed to fetch data" });
  }
};

const get_purchase_order_details = async (req, res) => {
  const { po_access_token } = req.params;

  try {
    if (po_access_token) {
      let query = `SELECT po.*, uc.access_token FROM sell.purchase_order po 
                  LEFT JOIN sell.eshop_form ef
                  ON ef.shop_no = po.seller_id
                  LEFT JOIN sell.user_credentials uc
                  ON uc.user_id = ef.user_id
                  WHERE po.po_access_token = $1`;
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
    // console.error(e);
    res.status(500).json({ e: "Failed to fetch data" });
  }
};


const get_purchase_order_numbers = async (req, res) => {
  const { seller_id, date } = req.params;

  try {
    if (seller_id && date) {
      let query = `SELECT po_no FROM sell.purchase_order WHERE seller_id = $1 AND date_of_issue = $2`;
      let result = await ambarsariyaPool.query(query, [seller_id, date]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the shop_no is invalid
        res
          .json({ valid: false, message: "No purchase order exists." });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    // console.error(e);
    res.status(500).json({ e: "Failed to fetch data" });
  }
};


const get_all_purchased_orders = async (req, res) => {
  const { buyer_id } = req.params;

  try {
    if (buyer_id) {
      let query = `SELECT 
        po.po_no, po.total_amount, ts.service, po.shipping_method, po.payment_method, so.products , po.buyer_gst_number, po.discount_amount, 
        po.status AS purchase_order_status,
		    so.status AS sale_order_status 
      FROM sell.purchase_order po
      LEFT JOIN sell.sale_order so
      ON so.buyer_id = po.buyer_id AND so.po_no = po.po_no
      LEFT JOIN type_of_services ts
      ON ts.id = po.shipping_method
      WHERE po.buyer_id = $1 
      ORDER BY po.po_no desc`;
      let result = await ambarsariyaPool.query(query, [buyer_id]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the shop_no is invalid
        res
          .status(404)
          .json({ valid: false, message: "No order exists." });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    // console.error(e);
    res.status(500).json({ e: "Failed to fetch data" });
  }
};


const get_purchased_order = async (req, res) => {
  const { po_no } = req.params;

  try {
    if (po_no) {
      let query = `SELECT 
        po.po_no,
		po.buyer_id,
		po.buyer_type,
		po.seller_id,
		po.buyer_gst_number,
		po.seller_gst_number,
        product->>'id' AS product_id, 
        product->>'name' AS product_name, 
        product->>'quantity' AS quantity, 
        product->>'unit_price' AS unit_price, 
        product->>'total_price' AS total_price, 
        product->>'selectedVariant' AS selectedVariant,  
        pr.brand,
        po.subtotal,  
        po.discount_applied,  
        po.taxes,  
        po.total_amount,  
        po.date_of_issue,  
        po.po_access_token,  
        pr.product_images,
        -- Distribute discount_amount equally across products
        ROUND((po.discount_amount / NULLIF(
            (SELECT COUNT(*) 
            FROM jsonb_array_elements(po.products::jsonb)), 0
        )), 2) AS discount_amount,
        po.discount_amount as total_discount_amount,
        ef.shop_access_token

    FROM sell.purchase_order po
    CROSS JOIN LATERAL jsonb_array_elements(po.products::jsonb) AS product
    LEFT JOIN sell.products pr 
        ON po.seller_id = pr.shop_no  
        AND product->>'id' = pr.product_id
    LEFT JOIN sell.eshop_form ef
    ON ef.shop_no = po.seller_id 
    WHERE po.po_no = $1 `;
      let result = await ambarsariyaPool.query(query, [po_no]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the shop_no is invalid
        res
          .status(404)
          .json({ valid: false, message: "No order exists." });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    // console.error(e);
    res.status(500).json({ e: "Failed to fetch data" });
  }
};

const get_buyer_details = async (req, res) => {
  const { po_no } = req.params;

  try {
    if (po_no) {
      let query = `select mp.member_id, u.full_name from 
                      sell.purchase_order po
                      left join sell.member_profiles mp
                      ON mp.member_id = po.buyer_id
                      left join sell.users u
                      ON u.user_id = mp.user_id
                      where po.po_no = $1 `;
      let result = await ambarsariyaPool.query(query, [po_no]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the shop_no is invalid
        res
          .status(404)
          .json({ valid: false, message: "No order exists." });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    // console.error(e);
    res.status(500).json({ e: "Failed to fetch data" });
  }
};


module.exports = {
  post_purchaseOrder,
  get_purchase_orders,
  get_purchase_order_details,
  get_purchase_order_numbers,
  get_all_purchased_orders,
  get_purchased_order,
  get_buyer_details
};
