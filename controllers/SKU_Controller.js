const { createDbPool } = require("../db_config/db");
const ambarsariyaPool = createDbPool();

const post_sku = async (req, res) => {
  const { sku_data } = req.body;

  try {
    await ambarsariyaPool.query("BEGIN"); // Start a transaction

    // Insert or update items
    for (let sku of sku_data) {
    
      // Insert or update the item
      const itemQuery = `
        INSERT INTO Sell.sku (
          sku_id,
          product_id,
          model_or_product_code,
          color,
          max_stock_size,
          location,
          no_of_walls_of_rack,
          no_of_racks_in_a_wall,
          min_stock,
          stock_level,
          low_stock,
          medium_stock,
          high_stock,
          total_area_of_shelf,
          total_area_of_shelves,
          total_shelf_area_occupied,
          max_shelf_area_occupied,
          no_of_shelves_occupied,
          max_racks,
          shelves_extra,
          items_per_shelf,
          max_rack_at_max_quantity,
          max_shelves,
          rku_id,
          total_no_of_shelf,
          shop_no
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
        )
        ON CONFLICT (sku_id, product_id, shop_no) 
        DO UPDATE SET
          sku_id = EXCLUDED.sku_id,
          product_id = EXCLUDED.product_id,
          model_or_product_code = EXCLUDED.model_or_product_code,
          color = EXCLUDED.color,
          max_stock_size = EXCLUDED.max_stock_size,
          location = EXCLUDED.location,
          no_of_walls_of_rack = EXCLUDED.no_of_walls_of_rack,
          no_of_racks_in_a_wall = EXCLUDED.no_of_racks_in_a_wall,
          min_stock = EXCLUDED.min_stock,
          stock_level = EXCLUDED.stock_level,
          low_stock = EXCLUDED.low_stock,
          medium_stock = EXCLUDED.medium_stock,
          high_stock = EXCLUDED.high_stock,
          total_area_of_shelf = EXCLUDED.total_area_of_shelf,
          total_area_of_shelves = EXCLUDED.total_area_of_shelves,
          total_shelf_area_occupied = EXCLUDED.total_shelf_area_occupied,
          max_shelf_area_occupied = EXCLUDED.max_shelf_area_occupied,
          no_of_shelves_occupied = EXCLUDED.no_of_shelves_occupied,
          max_racks = EXCLUDED.max_racks,
          shelves_extra = EXCLUDED.shelves_extra,
          items_per_shelf = EXCLUDED.items_per_shelf,
          max_rack_at_max_quantity = EXCLUDED.max_rack_at_max_quantity,
          max_shelves = EXCLUDED.max_shelves,
          rku_id = EXCLUDED.rku_id,
          total_no_of_shelf = EXCLUDED.total_no_of_shelf,
          shop_no = EXCLUDED.shop_no;
      `;

      // Execute query with item values
      await ambarsariyaPool.query(itemQuery, [
        sku.sku_id,
        sku.product_id,
        sku.model_or_product_code,
        sku.color,
        sku.max_stock_size,
        sku.location,
        sku.no_of_walls_of_rack,
        sku.no_of_racks_in_a_wall,
        sku.min_stock,
        sku.stock_level,
        sku.low_stock,
        sku.medium_stock,
        sku.high_stock,
        sku.total_area_of_shelf,
        sku.total_area_of_shelves,
        sku.total_shelf_area_occupied,
        sku.max_shelf_area_occupied,
        sku.no_of_shelves_occupied,
        sku.max_racks,
        sku.shelves_extra,
        sku.items_per_shelf,
        sku.max_rack_at_max_quantity,
        sku.max_shelves,
        sku.rku_id,
        sku.total_no_of_shelf,
        sku.shop_no
      ]);
    }

    await ambarsariyaPool.query("COMMIT"); // Commit transaction if successful
    res.status(201).json({ message: "SKU created successfully" });
  } catch (err) {
    await ambarsariyaPool.query("ROLLBACK"); // Rollback on error
    console.error("Error creating sku: ", err);
    res.status(500).json({ error: "Error creating sku", message: err });
  }
};



const get_sku = async (req, res) => {
  const { shop_no } = req.params;

  try {
    if (shop_no) {
      let query = `SELECT sku_id, 
            no_of_walls_of_rack,
            no_of_racks_in_a_wall 
          FROM sell.sku WHERE shop_no = $1`;
      let result = await ambarsariyaPool.query(query, [shop_no]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the shop_no is invalid
        res
          .json({ valid: false, message: "No sku's are there." });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ e: "Failed to fetch data" });
  }
};



module.exports = { post_sku, get_sku };
