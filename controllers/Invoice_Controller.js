const { createDbPool } = require("../db_config/db");
const { decryptData } = require("../utils/cryptoUtils");
const ambarsariyaPool = createDbPool();

const post_invoiceOrder = async (req, res) => {
  const { data } = req.body;
  console.log(data);

  try {
    await ambarsariyaPool.query("BEGIN"); // Start transaction
    
    // Insert purchase order
    const productQuery = `
  INSERT INTO Sell.invoice_order (
    po_no, so_no, seller_id, seller_name, domain_id, domain_name, sector_id,
    sector_name, shop_name, shop_location, shop_address, shop_city,
    shop_contact, shop_email, products, subtotal, discount_applied, discount_amount,
    tax_applied, total_amount, order_status, payment_status, hold, paid, b_o,
    transaction_no, payment_mode, business_order, location_of_store, seller_gst,
    seller_msme, seller_pan, seller_cin, gcst_paid, gsct_paid,
    payment_gateway_integrations_razor_pay_fees, date_and_time,
    buyer_payment_location, return_refund_deny_policy, buyer_name, buyer_id,
    buyer_address, buyer_location, buyer_contact_no,buyer_email, payment_type,
    payment_details, crm_no, share_invoice_services, co_helper,
    prepaid_postpaid, delivery_order, download_pdf, qr_code,
    buyer_special_note, emall_special_note
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
    $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
    $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44,
    $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56
  )
  ON CONFLICT (po_no, so_no) DO UPDATE SET
    seller_id = EXCLUDED.seller_id,
    seller_name = EXCLUDED.seller_name,
    domain_id = EXCLUDED.domain_id,
    domain_name = EXCLUDED.domain_name,
    sector_id = EXCLUDED.sector_id,
    sector_name = EXCLUDED.sector_name,
    shop_name = EXCLUDED.shop_name,
    shop_location = EXCLUDED.shop_location,
    shop_address = EXCLUDED.shop_address,
    shop_city = EXCLUDED.shop_city,
    shop_contact = EXCLUDED.shop_contact,
    shop_email = EXCLUDED.shop_email,
    products = EXCLUDED.products,
    subtotal = EXCLUDED.subtotal,
    discount_applied = EXCLUDED.discount_applied,
    discount_amount = EXCLUDED.discount_amount,
    tax_applied = EXCLUDED.tax_applied,
    total_amount = EXCLUDED.total_amount,
    order_status = EXCLUDED.order_status,
    payment_status = EXCLUDED.payment_status,
    hold = EXCLUDED.hold,
    paid = EXCLUDED.paid,
    b_o = EXCLUDED.b_o,
    transaction_no = EXCLUDED.transaction_no,
    payment_mode = EXCLUDED.payment_mode,
    business_order = EXCLUDED.business_order,
    location_of_store = EXCLUDED.location_of_store,
    seller_gst = EXCLUDED.seller_gst,
    seller_msme = EXCLUDED.seller_msme,
    seller_pan = EXCLUDED.seller_pan,
    seller_cin = EXCLUDED.seller_cin,
    gcst_paid = EXCLUDED.gcst_paid,
    gsct_paid = EXCLUDED.gsct_paid,
    payment_gateway_integrations_razor_pay_fees = EXCLUDED.payment_gateway_integrations_razor_pay_fees,
    date_and_time = EXCLUDED.date_and_time,
    buyer_payment_location = EXCLUDED.buyer_payment_location,
    return_refund_deny_policy = EXCLUDED.return_refund_deny_policy,
    buyer_name = EXCLUDED.buyer_name,
    buyer_id = EXCLUDED.buyer_id,
    buyer_address = EXCLUDED.buyer_address,
    buyer_location = EXCLUDED.buyer_location,
    buyer_contact_no = EXCLUDED.buyer_contact_no,
    buyer_email = EXCLUDED.buyer_email,
    payment_type = EXCLUDED.payment_type,
    payment_details = EXCLUDED.payment_details,
    crm_no = EXCLUDED.crm_no,
    share_invoice_services = EXCLUDED.share_invoice_services,
    co_helper = EXCLUDED.co_helper,
    prepaid_postpaid = EXCLUDED.prepaid_postpaid,
    delivery_order = EXCLUDED.delivery_order,
    download_pdf = EXCLUDED.download_pdf,
    qr_code = EXCLUDED.qr_code,
    buyer_special_note = EXCLUDED.buyer_special_note,
    emall_special_note = EXCLUDED.emall_special_note
  RETURNING invoice_no;
`;


    const purchase_order = await ambarsariyaPool.query(productQuery, [
      data.po_no,
        data.so_no,
        data.seller_id,
        data.seller_name,
        data.domain_id,
        data.domain_name,
        data.sector_id,
        data.sector_name,
        data.shop_name,
        data.shop_location,
        data.shop_address,
        data.shop_city,
        data.shop_contact,
        data.shop_email,
        data.products,
        data.subtotal,
        data.discount_applied,
        data.discount_amount,
        data.tax_applied,
        data.total_amount,
        data.order_status,
        data.payment_status,
        data.hold,
        data.paid,
        data.b_o,
        data.transaction_no,
        data.payment_mode,
        data.business_order,
        data.location_of_store,
        data.seller_gst,
        data.seller_msme,
        data.seller_pan,
        data.seller_cin,
        data.gcst_paid,
        data.gsct_paid,
        data.payment_gateway_integrations_razor_pay_fees,
        data.date_and_time,
        data.buyer_payment_location,
        data.return_refund_deny_policy,
        data.buyer_name,
        data.buyer_id,
        data.buyer_address,
        data.buyer_location,
        data.buyer_contact_no,
        data.buyer_email,
        data.payment_type,
        data.payment_details,
        data.crm_no,
        data.share_invoice_services,
        data.co_helper,
        data.prepaid_postpaid,
        data.delivery_order,
        data.download_pdf,
        data.qr_code,
        data.buyer_special_note,
        data.emall_special_note
    ]);

    const invoice_no = purchase_order.rows[0].invoice_no;

    await ambarsariyaPool.query("COMMIT"); // Commit transaction if all goes well
    res.status(201).json({
      message: "Invoice order created successfully",
      invoice_no,
    });
  } catch (err) {
    await ambarsariyaPool.query("ROLLBACK"); // Rollback transaction in case of error
    console.error("Error inserting purchase order:", err);
    res.status(400).json({ error: "Order failed", message: err.message });
  }
};

const get_seller_details = async (req, res) => {
  const { shop_no } = req.params;
  console.log(shop_no);
  
  try {
  if (shop_no) {
    let query = `SELECT 
                  d.domain_name, 
                  d.domain_id, 
                  s.sector_id,
                  s.sector_name, 
                  ef.poc_name,
                  ef.address,
                  ef.business_name,
                  ef.gst,
                  ef.msme,
                  ef.latitude,
                  ef.longitude,
                  ef.upi_id,
                  u.pan_no,
                  u.cin_no,
                  u.phone_no_1,
                  u.phone_no_2,
                  uc.username
                FROM sell.eshop_form ef
                JOIN sell.users u ON u.user_id = ef.user_id
                JOIN sell.user_credentials uc ON uc.user_id = ef.user_id
                JOIN domains d ON d.domain_id = ef.domain
                JOIN sectors s ON s.sector_id = ef.sector
                WHERE ef.shop_no = $1`;

    let result = await ambarsariyaPool.query(query, [shop_no]);

    if (result.rowCount === 0) {
      return res.json({ valid: false, message: "Invalid shop number." });
    }

    const data = result.rows;

    // Decrypt UPI ID only if it's not null
    if (data[0].upi_id) {
      try {
        const decryptedUpi = decryptData(data[0].upi_id); // Replace with your decryption method
        data[0].upi_id = decryptedUpi;
      } catch (err) {
        console.error("UPI decryption failed:", err.message);
        data[0].upi_id = null; // Or leave as-is depending on your use case
      }
    }

    res.json({ valid: true, data });
  }
} catch (e) {
  console.error(e);
  res.status(500).json({ e: "Failed to fetch data" });
}

};

const get_buyer_details = async (req, res) => {
  const { user_id } = req.params;
  console.log(user_id);
  
  try {
    if (user_id) {
      let query = `SELECT 
                    u.full_name,
                    u.phone_no_1,
                    uc.username,
                    mp.address,
                    mp.latitude,
                    mp.longitude
                  from sell.member_profiles mp
                  join sell.users u
                  on u.user_id = mp.user_id
                  join sell.user_credentials uc
                  on uc.user_id = mp.user_id
                  where mp.member_id = $1`;
      let result = await ambarsariyaPool.query(query, [user_id]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the user_id is invalid
        res
          .json({ valid: false, message: "Invalid buyer data." });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ e: "Failed to fetch data" });
  }
};


const get_purchased_products_details = async (req, res) => {
  const { product_id, item_id } = req.params;
  console.log(product_id, item_id);
  
  try {
    if (product_id && item_id) {
      let query = `select 
                    c.category_id,
                    c.category_name,
                    pr.brand,
                    i.specification_1,
                    i.specification_2,
                    i.specification_3,
                    i.specification_4,
                    pr.product_dimensions_width_in_cm,
                    pr.product_dimensions_height_in_cm,
                    pr.product_dimensions_breadth_in_cm,
                    i.weight_of_item,
                    i.item_area
                  from sell.products pr 
                  join categories c
                  on c.category_id = pr.category
                  join sell.items i 
                  on i.item_id = $2
                  where pr.product_id = $1`;
      let result = await ambarsariyaPool.query(query, [product_id, item_id]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the params is invalid
        res
          .json({ valid: false, message: "Invalid products data." });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ e: "Failed to fetch data" });
  }
};


const get_invoice_orders = async (req, res) => {
  const { invoice_no } = req.params;
  console.log(invoice_no);
  
  try {
    if (invoice_no) {
      let query = `SELECT io.*, po.created_at as po_created_at, so.created_at as so_created_at FROM sell.invoice_order io
        JOIN sell.purchase_order po
        ON po.po_no = io.po_no
        JOIN sell.sale_order so
        ON so.so_no = io.so_no 
      WHERE invoice_no = $1;
`;
      let result = await ambarsariyaPool.query(query, [invoice_no]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the invoice_no is invalid
        res
          .json({ valid: false, message: "No invoice exists." });
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
  post_invoiceOrder,
  get_invoice_orders,
  get_seller_details,
  get_buyer_details,
  get_purchased_products_details
};