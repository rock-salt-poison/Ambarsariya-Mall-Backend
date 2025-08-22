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
          member_name,
          experience_in_this_domain,
          last_job_fundamentals_or_skills_known,
          key_services,
          average_salary,
          last_salary
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        )
        ON CONFLICT (co_helper_type, member_id) DO UPDATE SET
          member_name = EXCLUDED.member_name,
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
        item.member_name,
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

const post_coHelperNotification = async (req, res) => {
  const { data } = req.body;
  console.log(data);

  try {
    await ambarsariyaPool.query("BEGIN");

      const coHelperQuery = `
        INSERT INTO sell.co_helper_notifications (
          requester_id,
          requester_name,
          co_helper_id,
          service,
          scope,
          task_date,
          task_time,
          task_location,
          task_details,
          estimated_hours,
          offerings,
          calendar_event_id,
          shop_no
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        )
        ON CONFLICT (requester_id, co_helper_id, task_date, task_time)
        DO NOTHING
        RETURNING id;
      `;

      const result = await ambarsariyaPool.query(coHelperQuery, [
        data?.requester_id,
        data?.requester_name,
        data?.co_helper_id,
        data?.service,
        data?.scope,
        data?.task_date,
        data?.task_time,
        data?.task_location,
        data?.task_details,
        data?.estimated_hours,
        data?.offerings,
        data?.calendar_event_id,
        data?.shop_no
      ]);

    await ambarsariyaPool.query("COMMIT");

    const insertedId = result.rows[0]?.id;

    res.status(201).json({
      message: "Notification sent to the Co-Helpers.",
      id: insertedId,
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

const get_member_notifications = async (req, res) => {
  const { member_id } = req.params;

  try {
    if (member_id) {
      console.log(member_id);
      
      let query = `SELECT 
                    chn.*,
                    ch.*,
                    chn.id as notification_number,
                    CASE 
                      WHEN ch.member_id = $1 THEN 'receiver'
                      WHEN chn.requester_id = $1 THEN 'sender'
                      ELSE NULL
                    END AS member_role,
                    chn.created_at as notification_created_at
                  FROM sell.co_helper_notifications chn
                  LEFT JOIN sell.co_helpers ch ON ch.id = chn.co_helper_id
                  WHERE ch.member_id = $1 OR chn.requester_id = $1;`;
      let result = await ambarsariyaPool.query(query, [member_id]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the shop_no is invalid
        res
          .json({ valid: false, message: `No new notifications.` });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ e: "Failed to fetch notifications" });
  }
};

const get_coHelpers_by_type_and_service = async (req, res) => {
  const { co_helper_type, key_service, buyer_member } = req.params;

  try {
    if (co_helper_type && key_service && buyer_member) {
      console.log(co_helper_type, key_service, buyer_member);
      
      let query = `SELECT member_id 
                   FROM sell.co_helpers 
                   WHERE co_helper_type = $1 
                   AND key_services ? $2
                   AND member_id != $3`;
      let result = await ambarsariyaPool.query(query, [co_helper_type, key_service, buyer_member]);
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

const get_requestedCoHelper = async (req, res) => {
  const { id } = req.params;

  try {
    if (id) {
      console.log(id);
      
      let query = `select 
                    chn.*, 
                    co.member_id, 
                    co.co_helper_type, 
                    co.experience_in_this_domain, 
                    co.last_job_fundamentals_or_skills_known, 
                    co.average_salary, 
                    co.last_salary 
                  from sell.co_helper_notifications chn 
                  left join sell.co_helpers co
                  on co.id = chn.co_helper_id
                  where chn.id = $1`;
      let result = await ambarsariyaPool.query(query, [id]);
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
      
      let query = `SELECT co.*, u.full_name, uc.access_token , uc.username
  FROM sell.co_helpers co
  LEFT JOIN sell.member_profiles mp 
    ON mp.member_id = co.member_id
  LEFT JOIN sell.users u
    ON u.user_id = mp.user_id
  LEFT JOIN sell.user_credentials uc
    ON uc.user_id = mp.user_id
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

const get_co_helper_popup_details = async (req, res) => {
  const { id, member_id } = req.params;

  try {
    if (id && member_id) {
      console.log(id, member_id);
      
      let query = `SELECT 
                    chn.id as notification_id,
                    chn.*,
                    ch.*,
                    CASE 
                      WHEN ch.member_id = $2 THEN 'receiver'
                      WHEN chn.requester_id = $2 THEN 'sender'
                      ELSE NULL
                    END AS member_role,
                    uc.username as requester_email,
                    ef.business_name,
                    ucef.username as shop_keeper_email,
                    chn.created_at as notification_created_at
                  FROM sell.co_helper_notifications chn
                  LEFT JOIN sell.co_helpers ch ON ch.id = chn.co_helper_id
                  LEFT JOIN sell.member_profiles mp ON chn.requester_id = mp.member_id
				          LEFT JOIN sell.user_credentials uc ON mp.user_id = uc.user_id
				          LEFT JOIN sell.eshop_form ef ON ef.shop_no = chn.shop_no
				          LEFT JOIN sell.user_credentials ucef ON ef.user_id = ucef.user_id
                  WHERE chn.id=$1`;
      let result = await ambarsariyaPool.query(query, [id, member_id]);
      if (result.rowCount === 0) {
        // If no rows are found, assume the shop_no is invalid
        res
          .json({ valid: false, message: `Invalid notification id or member id.` });
      } else {
        res.json({ valid: true, data: result.rows });
      }
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ e: "Failed to fetch details" });
  }
};

module.exports = { 
  post_coHelper, 
  get_coHelper, 
  get_coHelpers_by_type_and_service, 
  get_coHelpers_by_type_service_member_id, 
  post_coHelperNotification,
  get_member_notifications ,
  get_co_helper_popup_details,
  get_requestedCoHelper
};
