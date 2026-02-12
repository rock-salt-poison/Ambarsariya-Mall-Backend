const { createDbPool } = require("../db_config/db");
const ambarsariyaPool = createDbPool();
const nodemailer = require("nodemailer");
require("dotenv").config();

// SMTP setup
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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
        products, subtotal, shipping_address, shipping_method, shipping_details, payment_method, 
        special_offers, discount_applied, taxes, co_helper, discount_amount, 
        pre_post_paid, extra_charges, total_amount, date_of_issue, 
        delivery_terms, additional_instructions, coupon_cost, buyer_name, buyer_contact_no
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 
        $17, $18, $19, $20, $21, $22, $23, $24, $25
      ) 
      RETURNING po_access_token
    `;

    const purchase_order = await ambarsariyaPool.query(productQuery, [
      data.buyer_id, data.buyer_type, data.seller_id, data.buyer_gst_number, 
      data.seller_gst_number, JSON.stringify(data.products), data.subtotal, 
      data.shipping_address, data.shipping_method, 
      data.shipping_details ? JSON.stringify(data.shipping_details) : null,
      data.payment_method, 
      JSON.stringify(data.special_offers), JSON.stringify(data.discount_applied), 
      data.taxes, JSON.stringify(data.co_helper), data.discount_amount, data.pre_post_paid, 
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
    
    // Send emails to buyer and seller (don't fail if email fails)
    try {
      await sendPurchaseOrderEmails(data, po_access_token);
    } catch (emailError) {
      console.error("Error sending purchase order emails:", emailError);
      // Don't fail the request if email fails
    }
    
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


const put_purchaseOrderDiscount = async (req, res) => {
  const { data, previous_discount } = req.body; 
  const { po_access_token } = req.params;

  console.log(data, previous_discount, po_access_token);
  

  try {
    await ambarsariyaPool.query("BEGIN"); // Start transaction

    // 1. Update purchase order with new discount
    const productQuery = `
      UPDATE Sell.purchase_order
        SET discount_applied = $1,
            discount_amount = $2
        WHERE po_access_token = $3
        RETURNING po_no
    `;

    const purchase_order = await ambarsariyaPool.query(productQuery, [
      JSON.stringify(data.discount_applied),
      data.discount_amount,
      po_access_token,
    ]);

    const updatedPoNo = purchase_order.rows[0].po_no;

    // 2. If there was a previous discount coupon, increment it back
    if (previous_discount?.coupon_type) {
      const incrementPrevCouponQuery = `
        UPDATE Sell.discount_coupons
        SET no_of_coupons = no_of_coupons + 1
        WHERE coupon_type = $1 AND shop_no = $2
        RETURNING no_of_coupons
      `;
      await ambarsariyaPool.query(incrementPrevCouponQuery, [
        previous_discount.coupon_type,
        data.seller_id,
      ]);
    }

    // 3. If new coupon applied, decrement its count
    if (data?.discount_applied?.coupon_type) {
      const decrementCurrentCouponQuery = `
        UPDATE Sell.discount_coupons
        SET no_of_coupons = GREATEST(no_of_coupons - 1, 0)
        WHERE coupon_type = $1 AND shop_no = $2
        RETURNING no_of_coupons
      `;
      await ambarsariyaPool.query(decrementCurrentCouponQuery, [
        data.discount_applied.coupon_type,
        data.seller_id,
      ]);
    }

    // Commit transaction
    await ambarsariyaPool.query("COMMIT");

    res.status(201).json({
      message: "Purchase order discount updated successfully",
      po_no: updatedPoNo,
    });
  } catch (err) {
    await ambarsariyaPool.query("ROLLBACK"); // Rollback on error
    console.error("Error updating purchase order discount:", err);
    res.status(400).json({ error: "Order update failed", message: err.message });
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
        po.buyer_name, 
        po.buyer_contact_no, 
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
        po.status AS purchase_order_status,
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
        ) AS items,
      uc.access_token as buyer_access_token,

      chn.id as co_helper_notification_id,
      chn.requester_id,
      chn.task_date as co_helper_task_date,
      chn.task_time as co_helper_task_time,
      chn.task_details as co_helper_task_details,
      chn.estimated_hours as co_helper_estimated_hours,
      chn.offerings as co_helper_offerings,
      chn.status as co_helper_status,
      chn.created_at as co_helper_request_created_at,
      chn.task_location as co_helper_task_location,
      chn.service as co_helper_requested_service,
      co.member_id as co_helper_member_id,
      co.co_helper_type,
      co.experience_in_this_domain,
      co.last_job_fundamentals_or_skills_known,
      co.average_salary as co_helper_average_salary,
      co.last_salary as co_helper_last_salary
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
    LEFT JOIN sell.member_profiles mp
    ON mp.member_id = po.buyer_id 
	  LEFT JOIN sell.user_credentials uc
    ON uc.user_id = mp.user_id  
    LEFT JOIN sell.co_helper_notifications chn
    ON chn.id = (po.co_helper->>'id')::int
    LEFT JOIN sell.co_helpers co
    ON co.id = chn.co_helper_id  

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
        po.po_no, COALESCE(so.subtotal, po.total_amount) as total_amount, ts.service, po.shipping_method, po.payment_method, so.products , po.buyer_gst_number, po.discount_amount, 
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

// Function to send purchase order emails to buyer and seller
const sendPurchaseOrderEmails = async (data, po_access_token) => {
  try {
    // Fetch buyer email
    let buyerEmail = null;
    if (data.buyer_type === "member" || data.buyer_type === "merchant") {
      const buyerQuery = `
        SELECT uc.username as email, u.full_name
        FROM sell.member_profiles mp
        JOIN sell.users u ON u.user_id = mp.user_id
        JOIN sell.user_credentials uc ON uc.user_id = mp.user_id
        WHERE mp.member_id = $1
      `;
      const buyerResult = await ambarsariyaPool.query(buyerQuery, [data.buyer_id]);
      if (buyerResult.rows.length > 0) {
        buyerEmail = buyerResult.rows[0].email;
      }
    } else if (data.buyer_type === "visitor") {
      const buyerQuery = `
        SELECT username as email, name as full_name
        FROM sell.support
        WHERE visitor_id = $1
      `;
      const buyerResult = await ambarsariyaPool.query(buyerQuery, [data.buyer_id]);
      if (buyerResult.rows.length > 0) {
        buyerEmail = buyerResult.rows[0].email;
      }
    }

    // Fetch seller email and shop address
    const sellerQuery = `
      SELECT uc.username as email, ef.business_name, u.full_name, ef.address as shop_address
      FROM sell.eshop_form ef
      JOIN sell.users u ON u.user_id = ef.user_id
      JOIN sell.user_credentials uc ON uc.user_id = ef.user_id
      WHERE ef.shop_no = $1
    `;
    const sellerResult = await ambarsariyaPool.query(sellerQuery, [data.seller_id]);
    const sellerEmail = sellerResult.rows.length > 0 ? sellerResult.rows[0].email : null;
    const sellerBusinessName = sellerResult.rows.length > 0 ? sellerResult.rows[0].business_name : null;
    const sellerFullName = sellerResult.rows.length > 0 ? sellerResult.rows[0].full_name : null;
    const shopAddress = sellerResult.rows.length > 0 ? sellerResult.rows[0].shop_address : null;

    // Fetch product images and details
    const productIds = data.products.map(p => p.id);
    const productsQuery = `
      SELECT product_id, product_name, product_images
      FROM sell.products
      WHERE product_id = ANY($1::text[])
    `;
    const productsResult = await ambarsariyaPool.query(productsQuery, [productIds]);
    const productsMap = {};
    productsResult.rows.forEach(row => {
      let images = [];
      if (row.product_images) {
        // Handle both JSONB arrays and string arrays
        if (typeof row.product_images === 'string') {
          try {
            images = JSON.parse(row.product_images);
          } catch (e) {
            images = [row.product_images];
          }
        } else if (Array.isArray(row.product_images)) {
          images = row.product_images;
        }
      }
      productsMap[row.product_id] = {
        name: row.product_name,
        images: images
      };
    });

    // Fetch service type name
    let serviceTypeName = null;
    if (data.shipping_method) {
      const serviceQuery = `
        SELECT service
        FROM type_of_services
        WHERE id = $1
      `;
      const serviceResult = await ambarsariyaPool.query(serviceQuery, [data.shipping_method]);
      if (serviceResult.rows.length > 0) {
        serviceTypeName = serviceResult.rows[0].service;
      }
    }

    // Fetch pickup settings if service type is Pickup (id = 3)
    let pickupSettings = null;
    if (data.shipping_method === 3) { // Pickup service type
      const pickupQuery = `
        SELECT 
          pickup_availability,
          pickup_location,
          pickup_start_time,
          pickup_end_time,
          pickup_confirmation
        FROM sell.shop_pickup_settings
        WHERE shop_no = $1
      `;
      const pickupResult = await ambarsariyaPool.query(pickupQuery, [data.seller_id]);
      if (pickupResult.rows.length > 0) {
        const row = pickupResult.rows[0];

        pickupSettings = {
          ...row,
          pickup_location: row.pickup_location?.formatted_address ||
          row.pickup_location?.description ||
          null, // only description
        };
      } else {
        // If no pickup settings found, use shop address as pickup location
        pickupSettings = {
          pickup_location: shopAddress,
          pickup_availability: null,
          pickup_start_time: null,
          pickup_end_time: null,
          pickup_confirmation: null
        };
      }
    }

    // Create email HTML
    const emailHTML = createPurchaseOrderEmailHTML(data, productsMap, serviceTypeName, po_access_token, sellerBusinessName, pickupSettings);

    // Send email to buyer
    if (buyerEmail) {
      const buyerMailOptions = {
        from: process.env.SMTP_USER,
        to: buyerEmail,
        subject: `Purchase Order Confirmation - Order #${po_access_token}`,
        html: emailHTML
      };
      await transporter.sendMail(buyerMailOptions);
      console.log(`Purchase order email sent to buyer: ${buyerEmail}`);
    }

    // Send email to seller
    if (sellerEmail) {
      const sellerMailOptions = {
        from: process.env.SMTP_USER,
        to: sellerEmail,
        subject: `New Purchase Order Received - Order #${po_access_token}`,
        html: emailHTML
      };
      await transporter.sendMail(sellerMailOptions);
      console.log(`Purchase order email sent to seller: ${sellerEmail}`);
    }
  } catch (error) {
    console.error("Error in sendPurchaseOrderEmails:", error);
    throw error;
  }
};

// Function to create HTML email template
const createPurchaseOrderEmailHTML = (data, productsMap, serviceTypeName, po_access_token, sellerBusinessName, pickupSettings) => {
  const formatDate = (date) => {
    if (!date) return "N/A";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  };

  const formatCurrency = (amount) => {
    if (!amount) return "₹0.00";
    return `₹${parseFloat(amount).toFixed(2)}`;
  };

  // Convert 24-hour time to 12-hour format (HH:MM or HH:MM:SS to hh:mm AM/PM)
  const formatTime12Hour = (timeStr) => {
    if (!timeStr) return "";
    // Handle TIME format (HH:MM:SS) - extract HH:MM
    const time = timeStr.substring(0, 5);
    const [hours, minutes] = time.split(':');
    const hour24 = parseInt(hours, 10);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Build products HTML
  let productsHTML = "";
  data.products.forEach(product => {
    const productInfo = productsMap[product.id] || {};
    const productImages = productInfo.images || [];
    const firstImage = Array.isArray(productImages) && productImages.length > 0 
      ? productImages[0] 
      : null;
    
    productsHTML += `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 15px;">
          ${firstImage ? `<img src="${firstImage}" alt="${product.name}" style="max-width: 100px; height: auto; border-radius: 5px;">` : '<div style="width: 100px; height: 100px; background: #f0f0f0; border-radius: 5px; display: flex; align-items: center; justify-content: center; color: #999;">No Image</div>'}
        </td>
        <td style="padding: 15px;">
          <strong>${product.name || productInfo.name || "N/A"}</strong><br>
          ${product.description ? `<small style="color: #666;">${product.description}</small>` : ""}
          ${product.selectedVariant ? `<br><small style="color: #666;">Variant: ${product.selectedVariant}</small>` : ""}
        </td>
        <td style="padding: 15px; text-align: center;">${product.quantity || 0}</td>
        <td style="padding: 15px; text-align: right;">${formatCurrency(product.unit_price)}</td>
        <td style="padding: 15px; text-align: right;">${formatCurrency(product.total_price)}</td>
      </tr>
    `;
  });

  // Service details HTML
  let serviceDetailsHTML = "";
  const isPickup = serviceTypeName === "Pickup";
  
  if (serviceTypeName) {
    serviceDetailsHTML += `<p><strong>Service Type:</strong> ${serviceTypeName}</p>`;
    
    // Add pickup location and hours if service type is Pickup
    if (isPickup && pickupSettings) {
      if (pickupSettings.pickup_location) {
        serviceDetailsHTML += `<p><strong>Pickup Location:</strong> ${pickupSettings.pickup_location}</p>`;
      }
      if (pickupSettings.pickup_start_time && pickupSettings.pickup_end_time) {
        const startTime = formatTime12Hour(pickupSettings.pickup_start_time);
        const endTime = formatTime12Hour(pickupSettings.pickup_end_time);
        serviceDetailsHTML += `<p><strong>Pickup Availability Hours:</strong> ${startTime} - ${endTime}</p>`;
      }
    }
    
    if (data.shipping_details) {
      const shippingDetails = typeof data.shipping_details === 'string' 
        ? JSON.parse(data.shipping_details) 
        : data.shipping_details;
      
      if (shippingDetails.instructions) {
        serviceDetailsHTML += `<p><strong>Instructions:</strong> ${shippingDetails.instructions}</p>`;
      }
      if (shippingDetails.estimated_pickup_time) {
        // Convert estimated pickup time to 12-hour format
        const estimatedTime = shippingDetails.estimated_pickup_time;
        let formattedEstimatedTime = estimatedTime;
        
        // Check if it's already in 12-hour format (contains AM/PM) or needs conversion
        if (estimatedTime && !estimatedTime.match(/\s(AM|PM)/i)) {
          // It's in 24-hour format, convert it
          formattedEstimatedTime = formatTime12Hour(estimatedTime);
        }
        serviceDetailsHTML += `<p><strong>Estimated Pickup Time:</strong> ${formattedEstimatedTime}</p>`;
      }
      
      // Show confirmation from member (buyer)
      if (shippingDetails.confirmation) {
        serviceDetailsHTML += `<p><strong>Member Confirmation:</strong> ${shippingDetails.confirmation}</p>`;
      }
    }
    
    // Show merchant confirmation from pickup settings (if pickup service)
    if (isPickup && pickupSettings && pickupSettings.pickup_confirmation !== null) {
      const merchantConfirmation = pickupSettings.pickup_confirmation ? "Yes" : "No";
      serviceDetailsHTML += `<p><strong>Merchant Confirmation:</strong> ${merchantConfirmation}</p>`;
    }
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Purchase Order Confirmation</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Purchase Order Confirmation</h1>
        <p style="color: white; margin: 10px 0 0 0;">Order #${po_access_token}</p>
      </div>
      
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #667eea; margin-top: 0;">Order Details</h2>
        
        <div style="background: white; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #333;">Order Information</h3>
          <p><strong>Order Number:</strong> ${po_access_token}</p>
          <p><strong>Date:</strong> ${formatDate(data.date_of_issue)}</p>
          <p><strong>Buyer Name:</strong> ${data.buyer_name || "N/A"}</p>
          <p><strong>Buyer Contact:</strong> ${data.buyer_contact_no || "N/A"}</p>
          ${sellerBusinessName ? `<p><strong>Seller:</strong> ${sellerBusinessName}</p>` : ""}
          <p><strong>Payment Method:</strong> ${data.payment_method || "N/A"}</p>
          ${!isPickup && data.shipping_address ? `<p><strong>Shipping Address:</strong> ${data.shipping_address}</p>` : ""}
        </div>

        <div style="background: white; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #333;">Service Details</h3>
          ${serviceDetailsHTML || "<p>No service details available</p>"}
        </div>

        <div style="background: white; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #333;">Products</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f0f0f0;">
                <th style="padding: 15px; text-align: left;">Image</th>
                <th style="padding: 15px; text-align: left;">Product</th>
                <th style="padding: 15px; text-align: center;">Quantity</th>
                <th style="padding: 15px; text-align: right;">Unit Price</th>
                <th style="padding: 15px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${productsHTML}
            </tbody>
          </table>
        </div>

        <div style="background: white; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #333;">Order Summary</h3>
          <table style="width: 100%;">
            <tr>
              <td style="padding: 10px;"><strong>Subtotal:</strong></td>
              <td style="padding: 10px; text-align: right;">${formatCurrency(data.subtotal)}</td>
            </tr>
            ${data.discount_amount > 0 ? `
            <tr>
              <td style="padding: 10px;"><strong>Discount:</strong></td>
              <td style="padding: 10px; text-align: right; color: #28a745;">-${formatCurrency(data.discount_amount)}</td>
            </tr>
            ` : ""}
            ${data.taxes ? `
            <tr>
              <td style="padding: 10px;"><strong>Taxes:</strong></td>
              <td style="padding: 10px; text-align: right;">${formatCurrency(data.taxes)}</td>
            </tr>
            ` : ""}
            ${data.extra_charges ? `
            <tr>
              <td style="padding: 10px;"><strong>Extra Charges:</strong></td>
              <td style="padding: 10px; text-align: right;">${formatCurrency(data.extra_charges)}</td>
            </tr>
            ` : ""}
            <tr style="border-top: 2px solid #667eea;">
              <td style="padding: 10px;"><strong>Total Amount:</strong></td>
              <td style="padding: 10px; text-align: right; font-size: 1.2em; color: #667eea;"><strong>${formatCurrency(data.total_amount)}</strong></td>
            </tr>
          </table>
        </div>

        ${data.additional_instructions ? `
        <div style="background: white; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #333;">Additional Instructions</h3>
          <p>${data.additional_instructions}</p>
        </div>
        ` : ""}

        <div style="text-align: center; margin-top: 30px; padding: 20px; background: #f0f0f0; border-radius: 5px;">
          <p style="margin: 0; color: #666;">Thank you for your order!</p>
          <p style="margin: 10px 0 0 0; color: #666;">If you have any questions, please contact us.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};


module.exports = {
  post_purchaseOrder,
  get_purchase_orders,
  get_purchase_order_details,
  get_purchase_order_numbers,
  get_all_purchased_orders,
  get_purchased_order,
  get_buyer_details,
  put_purchaseOrderDiscount
};
