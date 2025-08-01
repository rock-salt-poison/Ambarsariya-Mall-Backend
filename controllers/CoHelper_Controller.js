const { createDbPool } = require("../db_config/db");
const ambarsariyaPool = createDbPool();

const post_coHelper = async (req, res) => {
  const { data } = req.body;

  try {
    await ambarsariyaPool.query("BEGIN");

    const insertedIds = [];

    for (const item of data) {
      const coHelperQuery = `
        INSERT INTO sell.co_helpers (
          co_helper_type,
          member_id,
          experience_in_this_domain,
          last_job_fundamentals_or_skills_known,
          key_services,
          average_salary,
          last_salary
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7
        )
        ON CONFLICT (co_helper_type, member_id) DO UPDATE SET
          experience_in_this_domain = EXCLUDED.experience_in_this_domain,
          last_job_fundamentals_or_skills_known = EXCLUDED.last_job_fundamentals_or_skills_known,
          key_services = EXCLUDED.key_services,
          average_salary = EXCLUDED.average_salary,
          last_salary = EXCLUDED.last_salary
        RETURNING id
      `;

      const result = await ambarsariyaPool.query(coHelperQuery, [
        item.co_helper_type,
        item.member_id,
        item.experience,
        item.last_job_skills,
        JSON.stringify(item.key_services),
        item.average_salary,
        item.last_salary,
      ]);

      insertedIds.push(result.rows[0].id);
    }

    await ambarsariyaPool.query("COMMIT");

    res.status(201).json({
      message: "Co-Helpers registered successfully.",
      inserted_ids: insertedIds,
    });

  } catch (err) {
    await ambarsariyaPool.query("ROLLBACK");
    console.error("Error registering co-helpers:", err);
    res.status(500).json({
      error: "Error registering co-helpers",
      message: err.message,
    });
  }
};




const get_coHelper = async (req, res) => {
  const { member_id, co_helper_type } = req.params;

  try {
    if (member_id && co_helper_type) {
      console.log(member_id, co_helper_type);
      
      let query = `SELECT * FROM sell.co_helpers WHERE member_id = $1 AND co_helper_type = $2`;
      let result = await ambarsariyaPool.query(query, [member_id, co_helper_type]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the shop_no is invalid
        res
          .json({ valid: false, message: `You are not registered as ${co_helper_type} before.` });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ e: "Failed to fetch data" });
  }
};

const get_coHelpers_by_type_and_service = async (req, res) => {
  const { co_helper_type, key_service } = req.params;

  try {
    if (co_helper_type && key_service) {
      console.log(co_helper_type, key_service);
      
      let query = `SELECT member_id FROM sell.co_helpers WHERE co_helper_type = $1 AND key_services ? $2`;
      let result = await ambarsariyaPool.query(query, [co_helper_type, key_service]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the shop_no is invalid
        res
          .json({ valid: false, message: `No co-helper exists.` });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ e: "Failed to fetch data" });
  }
};



const get_coHelpers_by_type_service_member_id = async (req, res) => {
  const { co_helper_type, key_service, member_id } = req.params;

  try {
    if (co_helper_type && key_service && member_id) {
      console.log(co_helper_type, key_service, member_id);
      
      let query = `SELECT co.*, u.full_name 
  FROM sell.co_helpers co
  LEFT JOIN sell.member_profiles mp 
    ON mp.member_id = co.member_id
  LEFT JOIN sell.users u
    ON u.user_id = mp.user_id
  WHERE co.co_helper_type = $1 
    AND co.key_services ? $2 
    AND co.member_id = $3`;
      let result = await ambarsariyaPool.query(query, [co_helper_type, key_service, member_id]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the shop_no is invalid
        res
          .json({ valid: false, message: `No co-helper exists.` });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ e: "Failed to fetch data" });
  }
};





module.exports = { post_coHelper, get_coHelper, get_coHelpers_by_type_and_service, get_coHelpers_by_type_service_member_id };
