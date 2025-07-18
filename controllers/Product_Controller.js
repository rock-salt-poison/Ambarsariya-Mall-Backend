const { createDbPool } = require("../db_config/db");
const ambarsariyaPool = createDbPool();

const post_products = async (req, res) => {
  const { products, categories } = req.body;
  const shopNo = products[0].shop_no; // Assuming all products belong to the same shop_no

  console.log(products);
  ambarsariyaPool.query("BEGIN"); // Start a transaction
  try {
    await ambarsariyaPool.query("BEGIN"); // Start a transaction

    for (let category of categories) {
      // 🔴 Step 1: Delete existing products for the given shop_no
      const deleteQuery = `DELETE FROM Sell.products WHERE shop_no = $1;`;
      await ambarsariyaPool.query(deleteQuery, [shopNo]);
    }

    // Insert products and product variants
    for (let product of products) {
      // Insert the variant group if it doesn't exist
      const variantQuery = `INSERT INTO Sell.product_variants (variant_group) 
                            VALUES ($1) 
                            ON CONFLICT (variant_group) DO NOTHING;`;
      await ambarsariyaPool.query(variantQuery, [product.variant_group]);

      const productNameAbbreviation = product.product_name
        .split(" ")
        .map((word) => word[0])
        .join("_")
        .toLowerCase();

      const product_id = `prod_${product.product_no}_${product.shop_no}_${product.category
        }_${productNameAbbreviation}_${product.product_type.toLowerCase()}`;

      // Insert the product data
      const productQuery = `INSERT INTO Sell.products (
        shop_no, 
        product_id,
        product_name, 
        product_type, 
        product_description, 
        category, 
        cost_price, 
        unit,
        brand, 
        iku_id,
        product_images, 
        product_dimensions_width_in_cm, 
        product_dimensions_height_in_cm, 
        product_dimensions_breadth_in_cm, 
        product_weight_in_kg, 
        packing, 
        product_style, 
        area_size_lateral,
        max_stock_quantity, 
        quantity_in_stock,
        shipping_information, 
        variant_group, 
        features, 
        keywords, 
        warranty_or_guarantee, 
        expiry_date, 
        manufacturer_details, 
        manufacturing_date, 
        compliance_and_certifications, 
        return_policy, 
        customer_reviews_and_ratings, 
        promotion_information, 
        related_products, 
        variation_1, 
        variation_2, 
        variation_3, 
        variation_4, 
        selling_price,
        product_catalog,
        brand_catalog, 
        variation_1_max_stock_quantity,
        variation_2_max_stock_quantity,
        variation_3_max_stock_quantity,
        variation_4_max_stock_quantity,
        variation_1_stock_quantity,
        variation_2_stock_quantity,
        variation_3_stock_quantity,
        variation_4_stock_quantity
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 
        $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48
      ) ON CONFLICT (product_id) DO NOTHING;`;

      await ambarsariyaPool.query(productQuery, [
        product.shop_no,
        product_id,
        product.product_name,
        product.product_type,
        product.product_description,
        product.category,
        product.cost_price,
        product.unit,
        product.brand,
        product.iku,
        product.product_images,
        product.product_dimensions_width_in_cm,
        product.product_dimensions_height_in_cm,
        product.product_dimensions_breadth_in_cm,
        product.product_weight_in_kg,
        product.packing,
        product.product_style,
        product.area_size_lateral,
        product.max_stock_quantity,
        product.max_stock_quantity,
        product.shipping_information,
        product.variant_group,
        product.features,
        product.keywords,
        product.warranty_or_guarantee,
        product.expiry_date,
        product.manufacturer_details,
        product.manufacturing_date,
        product.compliance_and_certifications,
        product.return_policy,
        product.customer_reviews_and_ratings,
        product.promotion_information,
        product.related_products,
        product.variation_1,
        product.variation_2,
        product.variation_3,
        product.variation_4,
        product.selling_price,
        product.product_catalog,
        product.brand_catalog,
        product.variation_1_max_stock_quantity,
        product.variation_2_max_stock_quantity,
        product.variation_3_max_stock_quantity,
        product.variation_4_max_stock_quantity,
        product.variation_1_stock_quantity,
        product.variation_2_stock_quantity,
        product.variation_3_stock_quantity,
        product.variation_4_stock_quantity,
      ]);
    }

    await ambarsariyaPool.query("COMMIT"); // Commit transaction if all goes well
    res.status(201).json({ message: "Products added successfully" });
  } catch (err) {
    await ambarsariyaPool.query("ROLLBACK"); // Rollback transaction in case of error
    console.error("Error inserting products or variants:", err);
    res.status(500).json({ error: "Error inserting products", message: err });
  }
};

const get_products = async (req, res) => {
  const { shop_no, product_id, item_id } = req.params;
  try {
    let query, result;

    // Check if 'product_id' exists and set the query accordingly
    if (shop_no && product_id) {
      query = `SELECT 
                p.*, 
                COALESCE(i.selling_price, p.selling_price) AS final_price
              FROM sell.products p
              LEFT JOIN sell.items i 
                ON i.product_id = p.product_id AND i.item_id = $3
              WHERE p.shop_no = $1 AND p.product_id = $2
              GROUP BY p.product_id, i.selling_price;
`;
      result = await ambarsariyaPool.query(query, [shop_no, product_id, item_id]);
    } else if (shop_no) {
      // query = `SELECT 
      //           p.*, 
      //           array_agg(i.item_id) AS item_ids,
      //           (
      //               SELECT i2.selling_price
      //               FROM sell.items i2
      //               WHERE i2.item_id = (
      //                   SELECT item_id
      //                   FROM sell.items
      //                   WHERE product_id = p.product_id
      //                     AND item_id LIKE '%' || p.iku_id[1]
      //                   LIMIT 1
      //               )
      //           ) AS first_iku_price
      //       FROM sell.products p
      //       LEFT JOIN sell.items i ON i.product_id = p.product_id
      //       WHERE p.shop_no = $1
      //       GROUP BY p.product_id;`;
      query = `SELECT 
  p.*, 
  array_agg(i.item_id) AS item_ids,
  i_match.item_id AS matched_item_id,
  COALESCE(i_match.selling_price, p.selling_price) AS matched_price,
  i_match.quantity_in_stock AS matched_quantity,
  i_match.subscribe,
  i_match.weekly_min_quantity,
  i_match.monthly_min_quantity,
  i_match.daily_min_quantity,
  i_match.editable_min_quantity,
  i_match.specification_1,
  i_match.specification_2,
  i_match.specification_3,
  i_match.specification_4
FROM sell.products p
LEFT JOIN sell.items i ON i.product_id = p.product_id
LEFT JOIN LATERAL (
  SELECT *
  FROM sell.items i2
  WHERE i2.product_id = p.product_id
    AND SPLIT_PART(i2.item_id, '_', array_length(string_to_array(i2.item_id, '_'), 1) - 2) = REPLACE(p.variation_1, ' ', '-')
  ORDER BY i2.item_id
  LIMIT 1
) i_match ON TRUE
WHERE p.shop_no = $1
GROUP BY p.product_id, i_match.item_id, i_match.selling_price, i_match.quantity_in_stock, i_match.subscribe, i_match.daily_min_quantity, i_match.weekly_min_quantity, i_match.monthly_min_quantity, i_match.weekly_min_quantity, i_match.editable_min_quantity, i_match.specification_1, i_match.specification_2, i_match.specification_3, i_match.specification_4;
`
      result = await ambarsariyaPool.query(query, [shop_no]);
    }

    if (result.rowCount === 0) {
      // If no rows are found, assume the shop_no is invalid
      res.json({ valid: false, message: "No products are there." });
    } else {
      res.json({ valid: true, data: result.rows });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ e: "Failed to fetch products" });
  }
};

const get_product_names = async (req, res) => {
  const { shop_no } = req.params;

  try {
    if (shop_no) {
      let query = `SELECT product_name, product_id FROM sell.products WHERE shop_no = $1`;
      let result = await ambarsariyaPool.query(query, [shop_no]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the shop_no is invalid
        res
          .json({ valid: false, message: "No products are there." });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ e: "Failed to fetch data" });
  }
};

// const get_product_variants = async (req, res) => {
//   const { shop_no, variant_group } = req.params;

//   try {
//     if (shop_no) {
//       let query = `SELECT * FROM sell.products WHERE shop_no = $1 AND variant_group = $2`;
//       let result = await ambarsariyaPool.query(query, [shop_no, variant_group]);
//       if (result.rowCount === 0) {
//         // If no rows are found, assume the shop_no is invalid
//         res
//           .status(404)
//           .json({ valid: false, message: "No variants are there." });
//       } else {
//         res.json({ valid: true, data: result.rows });
//       }
//     }
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ e: "Failed to fetch variants" });
//   }
// };

const get_product_variants = async (req, res) => {
  const { product_id } = req.params;

  try {
    if (product_id) {
      let query = `select 
                    i.*, 
                    p.product_name, 
                    p.product_images, 
                    p.product_type, 
                    p.product_description, 
                    p.brand, 
                    p.product_style, 
                    p.promotion_information, 
                    p.selling_price AS product_selling_price,
                    p.shop_no,
                    p.product_id
                  from sell.products p 
left join sell.items i on i.product_id = p.product_id 
where p.product_id = $1;`;
      let result = await ambarsariyaPool.query(query, [product_id]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the shop_no is invalid
        res
          .json({ valid: false, message: "No variants are there." });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ e: "Failed to fetch variants" });
  }
};


const get_in_stock_updates = async (req, res) => {
  const { shop_no } = req.params;

  try {
    if (shop_no) {
      let query = `SELECT p.product_id ,i.item_id, s.sku_id, s.space_available_for_no_of_items, p.selling_price, p.quantity_in_stock
        FROM sell.products p 
        LEFT JOIN sell.items i  ON i.product_id = p.product_id
        LEFT JOIN sell.sku s  ON s.product_id = p.product_id
        WHERE p.shop_no = $1`;
      let result = await ambarsariyaPool.query(query, [shop_no]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the shop_no is invalid
        res
          .json({ valid: false, message: "No products are there." });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ e: "Failed to fetch products" });
  }
};

module.exports = {
  post_products,
  get_products,
  get_product_names,
  get_product_variants,
  get_in_stock_updates
};
