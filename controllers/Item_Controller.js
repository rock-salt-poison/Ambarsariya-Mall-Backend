const { createDbPool } = require("../db_config/db");
const ambarsariyaPool = createDbPool();

const post_items = async (req, res) => {
  const { items } = req.body;

  try {
    await ambarsariyaPool.query("BEGIN"); // Start a transaction

    // Insert or update items
    for (let item of items) {
      // Extract product number and category number from product_id
      const prod_no = item.product_id.split("_")[1]; // e.g., prod_1 -> 1
      const category_no = item.product_id.split("_")[4]; // e.g., 597 from prod_1_shop_3_597_wg_gloves

      // Create item_id dynamically
      const item_id = `item_${item.item_no}_prod_${prod_no}_${item.shop_no}_category_${category_no}_${item.itemID}`;

      // Insert or update the item
      const itemQuery = `
        INSERT INTO Sell.items (
          item_id,
          product_id,
          shop_no,
          no_of_items,
          weight_of_item,
          item_area,
          make_material,
          storage_requirements,
          selling_price,
          cost_price,
          quantity_in_stock,
          max_item_quantity,
          subscribe,
          weekly_min_quantity,
          monthly_min_quantity,
          daily_min_quantity,
          editable_min_quantity,
          item_package_dimensions,
          color,
          specification_1,
          specification_2,
          specification_3,
          specification_4,
          no_of_racks,
          no_of_shelves,
          shelf_length,
          shelf_height,
          shelf_breadth,
          sku_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
        )
        ON CONFLICT (item_id) 
        DO UPDATE SET
          product_id = EXCLUDED.product_id,
          shop_no = EXCLUDED.shop_no,
          no_of_items = EXCLUDED.no_of_items,
          weight_of_item = EXCLUDED.weight_of_item,
          item_area = EXCLUDED.item_area,
          make_material = EXCLUDED.make_material,
          storage_requirements = EXCLUDED.storage_requirements,
          selling_price = EXCLUDED.selling_price,
          cost_price = EXCLUDED.cost_price,
          quantity_in_stock = EXCLUDED.quantity_in_stock,
          max_item_quantity = EXCLUDED.max_item_quantity,
          subscribe = EXCLUDED.subscribe,
          weekly_min_quantity = EXCLUDED.weekly_min_quantity,
          monthly_min_quantity = EXCLUDED.monthly_min_quantity,
          daily_min_quantity = EXCLUDED.daily_min_quantity,
          editable_min_quantity = EXCLUDED.editable_min_quantity,
          item_package_dimensions = EXCLUDED.item_package_dimensions,
          color = EXCLUDED.color,
          specification_1 = EXCLUDED.specification_1,
          specification_2 = EXCLUDED.specification_2,
          specification_3 = EXCLUDED.specification_3,
          specification_4 = EXCLUDED.specification_4,
          no_of_racks = EXCLUDED.no_of_racks,
          no_of_shelves = EXCLUDED.no_of_shelves,
          shelf_length = EXCLUDED.shelf_length,
          shelf_height = EXCLUDED.shelf_height,
          shelf_breadth = EXCLUDED.shelf_breadth,
          sku_id = EXCLUDED.sku_id;
      `;

      // Execute query with item values
      await ambarsariyaPool.query(itemQuery, [
        item_id, // Dynamically generated item_id
        item.product_id,
        item.shop_no,
        item.no_of_items,
        item.weight_of_item,
        item.item_area,
        item.make_material,
        item.storage_requirements,
        item.selling_price,
        item.cost_price,
        item.quantity_in_stock,
        item.max_item_quantity,
        item.subscribe,
        item.weekly_min_quantity,
        item.monthly_min_quantity,
        item.daily_min_quantity,
        item.editable_min_quantity,
        item.item_package_dimensions,
        item.color,
        item.specification_1,
        item.specification_2,
        item.specification_3,
        item.specification_4,
        item.no_of_racks,
        item.no_of_shelves,
        item.shelf_length,
        item.shelf_height,
        item.shelf_breadth,
        item.sku_id,
      ]);
    }

    await ambarsariyaPool.query("COMMIT"); // Commit transaction if successful
    res.status(201).json({ message: "Items added/updated successfully" });
  } catch (err) {
    await ambarsariyaPool.query("ROLLBACK"); // Rollback on error
    console.error("Error inserting or updating item: ", err);
    res.status(500).json({ error: "Error inserting/updating items", message: err });
  }
};



const get_items = async (req, res) => {
  const { shop_no } = req.params;

  try {
    if (shop_no) {
      let query = `SELECT item_id, no_of_racks, no_of_shelves, shelf_length, shelf_height, shelf_breadth FROM sell.items WHERE shop_no = $1`;
      let result = await ambarsariyaPool.query(query, [shop_no]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the shop_no is invalid
        res
          .status(404)
          .json({ valid: false, message: "No items are there." });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ e: "Failed to fetch data" });
  }
};



module.exports = { post_items, get_items };
