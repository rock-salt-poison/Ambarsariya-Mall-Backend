const { createDbPool } = require("../db_config/db");
const ambarsariyaPool = createDbPool();

const post_identification_of_mou = async (req, res) => {
  const { mou } = req.body;

  try {
    await ambarsariyaPool.query("BEGIN");

    if (mou.access_token) {
      // UPDATE existing record
      const updateQuery = `
        UPDATE sell.mou
        SET
          products = $1,
          selected_group = $2,
          vendors_or_shops = $3,
          buyer_id = $4,
          details_of_vendors_or_shops = $5,
          last_mou = $6
        WHERE access_token = $7
        RETURNING access_token
      `;

      const result = await ambarsariyaPool.query(updateQuery, [
        JSON.stringify(mou.products),
        mou.selected_group,
        JSON.stringify(mou.vendors_or_shops),
        mou.buyer_id,
        JSON.stringify(mou.details_of_vendors_or_shops),
        mou.last_mou,
        mou.access_token,
      ]);

      await ambarsariyaPool.query("COMMIT");
      return res.status(200).json({
        message: "MoU updated successfully",
        access_token: result?.rows[0]?.access_token,
      });
    } else {
      // INSERT new record
      const insertQuery = `
        INSERT INTO sell.mou (
          products,
          selected_group,
          vendors_or_shops,
          buyer_id,
          details_of_vendors_or_shops,
          last_mou
        ) VALUES (
          $1, $2, $3, $4, $5, $6
        ) RETURNING access_token
      `;

      const result = await ambarsariyaPool.query(insertQuery, [
        JSON.stringify(mou.products),
        mou.selected_group,
        JSON.stringify(mou.vendors_or_shops),
        mou.buyer_id,
        JSON.stringify(mou.details_of_vendors_or_shops),
        mou.last_mou,
      ]);

      await ambarsariyaPool.query("COMMIT");
      return res.status(201).json({
        message: "MoU created successfully",
        access_token: result?.rows[0]?.access_token,
      });
    }
  } catch (err) {
    await ambarsariyaPool.query("ROLLBACK");
    console.error("Error processing MoU: ", err);
    res.status(500).json({ error: "Error processing MoU", message: err });
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



module.exports = { post_identification_of_mou, get_items };
