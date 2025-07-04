const { createDbPool } = require("../db_config/db");
const ambarsariyaPool = createDbPool();

const post_rku = async (req, res) => {
  const { rku_data } = req.body;

  try {
    await ambarsariyaPool.query("BEGIN"); // Start a transaction

    const shopNo = rku_data[0].shop_no; // Get shop_no from the first record

    
      // Delete all existing records with matching shop_no
      await ambarsariyaPool.query("DELETE FROM Sell.rku WHERE shop_no = $1", [shopNo]);
    // Insert items
    for (let rku of rku_data) {
      // Insert or update the item
      const itemQuery = `
        INSERT INTO Sell.rku (
          RKU_ID,
          product,
          item,
          rack_no,
          required_id,
          product_id,
          placement_max,
          quantity_sale,
          placement_for_so,
          update_quantity,
          quantity_purchase,
          placement_for_po,
          shop_no
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        )`;

      // Execute query with item values
      await ambarsariyaPool.query(itemQuery, [
        rku.RKU_ID,
        rku.product,
        rku.item,
        rku.rack_no,
        rku.required_id,
        rku.product_id,
        rku.placement_max,
        rku.quantity_sale,
        rku.placement_for_so,
        rku.update_quantity,
        rku.quantity_purchase,
        rku.placement_for_po,
        rku.shop_no
      ]);
    }

    await ambarsariyaPool.query("COMMIT"); // Commit transaction if successful
    res.status(201).json({ message: "RKU created successfully" });
  } catch (err) {
    await ambarsariyaPool.query("ROLLBACK"); // Rollback on error
    console.error("Error creating rku: ", err);
    res.status(500).json({ error: "Error creating rku", message: err });
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



module.exports = { post_rku, get_sku };
