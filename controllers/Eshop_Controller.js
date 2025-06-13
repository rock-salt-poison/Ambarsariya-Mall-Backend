const { createDbPool } = require("../db_config/db");
const ambarsariyaPool = createDbPool();
const bcrypt = require("bcrypt");
const { uploadFileToGCS } = require("../utils/storageBucket");
const { deleteFileFromGCS } = require("../utils/deleteFileFromGCS");
const { encryptData, decryptData } = require("../utils/cryptoUtils");
const nodemailer = require('nodemailer');
const {broadcastMessage, emitChatMessage} = require("../webSocket");


const get_checkIfMemberExists = async (req, res) => {
  const { username, phone1, phone2 } = req.query;
  console.log(username, phone1, phone2);

  const normalizedPhone1 = phone1.replace(/\D/g, '').slice(-10);
  const normalizedPhone2 = phone2.replace(/\D/g, '').slice(-10);

  try {
    const memberQuery = `
      SELECT u.user_id, uc.username, u.phone_no_1
      FROM Sell.users u
      JOIN Sell.user_credentials uc ON u.user_id = uc.user_id
      WHERE u.user_type = 'member'
        AND (
          LOWER(uc.username) = LOWER($1)
          OR RIGHT(REGEXP_REPLACE(u.phone_no_1, '[^0-9]', '', 'g'), 10) IN ($2, $3)
          OR RIGHT(REGEXP_REPLACE(u.phone_no_2, '[^0-9]', '', 'g'), 10) IN ($2, $3)
        );
    `;

    const result = await ambarsariyaPool.query(memberQuery, [
      username.toLowerCase(),
      normalizedPhone1,
      normalizedPhone2,
    ]);

    if (result.rows.length === 0) {
      return res.status(200).json({
        exists: false,
        message: "No existing member found with this username or phone number.",
      });
    }

    const member = result.rows[0];

    // Now check if this member has a shop created
    const shopQuery = `
      SELECT shop_no, is_merchant
      FROM Sell.eshop_form
      WHERE user_id = $1
    `;
    const shopResult = await ambarsariyaPool.query(shopQuery, [member.user_id]);

    if (shopResult.rows.length > 0) {
      return res.status(200).json({
        exists: true,
        shopExists: true,
        message: "Member and shop already exist.",
        member,
        shop: shopResult.rows[0],
      });
    } else {
      return res.status(200).json({
        exists: true,
        shopExists: false,
        message: "Member exists, but shop is not yet created.",
        member,
      });
    }
  } catch (error) {
    console.error('Error checking member/shop existence:', error);
    return res.status(500).json({ message: 'Internal server error.', error: error.message });
  }
};

const get_checkIfShopExists = async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ message: "Username is required." });
  }

  try {
    const query = `
      SELECT ef.shop_no
      FROM Sell.eshop_form ef
      JOIN Sell.user_credentials uc ON ef.user_id = uc.user_id
      WHERE LOWER(uc.username) = LOWER($1)
      LIMIT 1;
    `;

    const result = await ambarsariyaPool.query(query, [username.toLowerCase()]);

    if (result.rows.length > 0) {
      return res.status(200).json({
        exists: true,
        message: "Shop already exists for this username.",
        shop_no: result.rows[0].shop_no,
      });
    } else {
      return res.status(200).json({
        exists: false,
        message: "No shop found for this username.",
      });
    }
  } catch (error) {
    console.error('Error checking shop existence:', error);
    return res.status(500).json({ message: 'Internal server error.', error: error.message });
  }
};


const post_book_eshop = async (req, resp) => {
  const {
    title,
    fullName,
    username,
    password,
    address,
    latitude,
    longitude,
    phone1,
    phone2,
    domain,
    domain_create,
    sector,
    sector_create,
    onTime,
    offTime,
    gst,
    msme,
    pan_no,
    cin_no,
    paidVersion,
    premiumVersion,
    merchant,
    member_detail,
    pickup,
    homeVisit,
    delivery,
    user_type,
  } = req.body;

  if (!fullName || !username || !password) {
    return resp
      .status(400)
      .json({ message: "Full name, username, and password are required." });
  }

  // Create `type_of_service` array based on user selection
  const typeOfService = [];
  if (pickup) typeOfService.push(1);
  if (homeVisit) typeOfService.push(2);
  if (delivery) typeOfService.push(3);

  try {
    // Check for existing member with same username or phone1
    const existingMemberCheck = await ambarsariyaPool.query(
      `SELECT u.user_id, uc.username, u.phone_no_1 
      FROM Sell.users u
      JOIN Sell.user_credentials uc ON u.user_id = uc.user_id
      WHERE u.user_type = 'member' AND (uc.username = $1 OR u.phone_no_1 = $2)`,
      [username.toLowerCase(), phone1]
    );

    if (existingMemberCheck.rows.length > 0) {
      return resp.status(409).json({
        message: "A member with the same username or phone number already exists.",
      });
    }


    // Begin transaction
    await ambarsariyaPool.query("BEGIN");

    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into users table
    const userResult = await ambarsariyaPool.query(
      `INSERT INTO Sell.users 
       (full_name, title, phone_no_1, phone_no_2, user_type, pan_no, cin_no)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING user_id`,
      [fullName, title, phone1, phone2, user_type, pan_no, cin_no]
    );
    const newUserId = userResult.rows[0].user_id;

    // Insert into eshop_form table
    const eshopResult = await ambarsariyaPool.query(
      `INSERT INTO Sell.eshop_form
       (user_id, poc_name, address, latitude, longitude, domain, created_domain, sector, created_sector,
        ontime, offtime, type_of_service, gst, msme, paid_version, is_merchant, member_username_or_phone_no, premium_service)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING shop_no, shop_access_token`,
      [
        newUserId,
        fullName,
        address,
        latitude,
        longitude,
        domain,
        domain_create,
        sector,
        sector_create,
        onTime,
        offTime,
        typeOfService,
        gst,
        msme,
        paidVersion,
        merchant,
        member_detail,
        premiumVersion,
      ]
    );

    const newShopNo = eshopResult.rows[0].shop_no;
    const shop_access_token = eshopResult.rows[0].shop_access_token;

    // Insert into user_credentials
    const userCredentials = await ambarsariyaPool.query(
      `INSERT INTO Sell.user_credentials 
       (user_id, username, password)
       VALUES ($1, $2, $3)
       RETURNING access_token`,
      [newUserId, username.toLowerCase(), hashedPassword]
    );

    const user_access_token = userCredentials.rows[0].access_token;

    // Insert into user_shops table
    await ambarsariyaPool.query(
      `INSERT INTO Sell.user_shops (user_id, shop_no) VALUES ($1, $2)`,
      [newUserId, newShopNo]
    );

    await ambarsariyaPool.query("COMMIT");

    resp.status(201).json({
      message: "E-shop data successfully created.",
      shop_access_token,
      user_access_token,
    });
  } catch (err) {
    await ambarsariyaPool.query("ROLLBACK");
    console.error("Error storing data", err);
    resp.status(500).json({
      message: "Error storing data",
      error: err.message,
    });
  }
};



const post_member_data = async (req, resp) => {
  console.log("Received files:", req.files["profile_img"]); // Log the file

  const { name, username, password, address, latitude, longitude, phone, gender, dob, access_token } = req.body;

  if (!name || !username ) {
    return resp
      .status(400)
      .json({ message: "Full name and username are required." });
  }

  let uploadedProfileUrl = null;
  let uploadedBgImgUrl = null;

  const profileFile = req.files["profile_img"] ? req.files["profile_img"][0] : null;
  const bgFile = req.files["bg_img"] ? req.files["bg_img"][0] : null;

  if (profileFile) {
    uploadedProfileUrl = await uploadFileToGCS(profileFile, "member/display_picture");
  }
  if (bgFile) {
    uploadedBgImgUrl = await uploadFileToGCS(bgFile, "member/background_picture");
  }

  // Determine title based on gender
  let title = gender === "Male" ? "Mr." : gender === "Female" ? "Ms." : "Other";

  try {
    await ambarsariyaPool.query("BEGIN"); // Start transaction

    const hashedPassword = await bcrypt.hash(password, 10);
    let newUserId;
    let existingProfileImg;
    let existingBgImg;
    let userAccessToken = access_token; // Use the provided access_token if available

    if (access_token) {
      // **Check if the access token exists in user_credentials**
      const userCheck = await ambarsariyaPool.query(
        `SELECT uc.user_id, mp.profile_img, mp.bg_img 
          FROM sell.user_credentials uc 
          JOIN sell.member_profiles mp ON mp.user_id = uc.user_id 
          WHERE uc.access_token = $1 AND uc.username = $2`,
        [access_token, username]
      );

      if (userCheck.rows.length > 0) {
        newUserId = userCheck.rows[0].user_id;
        existingProfileImg = userCheck.rows[0].profile_img;
        existingBgImg = userCheck.rows[0].bg_img;
        console.log(existingProfileImg, existingBgImg);

        if (uploadedProfileUrl && existingProfileImg) {
          try {
            await deleteFileFromGCS(existingProfileImg);
          } catch (error) {
            console.error("Error deleting old profile image:", error);
          }
        }
        
        if (uploadedBgImgUrl && existingBgImg) {
          try {
            await deleteFileFromGCS(existingBgImg);
          } catch (error) {
            console.error("Error deleting old background image:", error);
          }
        }
        

        // **Update existing user details**
        await ambarsariyaPool.query(
          `UPDATE sell.users 
           SET full_name = $1, title = $2, phone_no_1 = $3, gender = $4
           WHERE user_id = $5`,
          [name, title, phone, gender, newUserId]
        );

        await ambarsariyaPool.query(
          `UPDATE sell.member_profiles 
           SET address = $1, latitude = $2, longitude = $3, dob = $4, profile_img = $5, bg_img = $6
           WHERE user_id = $7`,
          [address, latitude, longitude, dob, uploadedProfileUrl || existingProfileImg, uploadedBgImgUrl || existingBgImg, newUserId]
        );
      } else {
        return resp.status(400).json({ message: "Invalid access token." });
      }
    } else {
      // **Insert new user record**
      const userResult = await ambarsariyaPool.query(
        `INSERT INTO sell.users 
              (full_name, title, phone_no_1, user_type, gender)
              VALUES ($1, $2, $3, $4, $5)
              RETURNING user_id`,
        [name, title, phone, "member", gender]
      );
      newUserId = userResult.rows[0].user_id;

      const userCredentials = await ambarsariyaPool.query(
        `INSERT INTO sell.user_credentials 
              (user_id, username, password)
              VALUES ($1, $2, $3)
              RETURNING access_token`,
        [newUserId, username, hashedPassword]
      );

      userAccessToken = userCredentials.rows[0].access_token;

      await ambarsariyaPool.query(
        `INSERT INTO sell.member_profiles 
              (user_id, address, latitude, longitude, dob, profile_img, bg_img)
              VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [newUserId, address, latitude, longitude, dob, uploadedProfileUrl, uploadedBgImgUrl]
      );
    }

    await ambarsariyaPool.query("COMMIT"); // Commit transaction

    resp.status(201).json({
      message: "Form submitted successfully.",
      user_access_token: userAccessToken,
    });
  } catch (err) {
    await ambarsariyaPool.query("ROLLBACK"); // Rollback in case of error
    console.error("Error storing data", err);
    resp.status(500).json({ message: "Error storing data", error: err.message });
  }
};


const update_eshop = async (req, resp) => {
  const {
    business_name,
    date_of_establishment,
    product_samples,
    upi_id, // This will be encrypted
    cost_sensitivity,
    daily_walkin,
    parking_availability,
    category,
    advt_video,
    key_players,
  } = req.body;

  console.log("Received file:", req.file); // Log the file

  const shopAccessToken = req.params.shopAccessToken;

  if (!shopAccessToken) {
    return resp.status(400).json({ message: "Shop access token is required." });
  }

  try {
    // Encrypt the UPI ID before storing
    const encryptedUPI = upi_id ? encryptData(upi_id) : null;

    // Fetch the existing file URL from the database
    const existingData = await ambarsariyaPool.query(
      `SELECT usp_values_url FROM Sell.eshop_form WHERE shop_access_token = $1`,
      [shopAccessToken]
    );

    if (existingData.rows.length === 0) {
      return resp
        .status(404)
        .json({ message: "No e-shop found with the provided access token." });
    }

    let uploadedUSPLink = existingData.rows[0].usp_values_url;

    if (req.file) {
      const targetFolder = "shop_usp_values_pdf";

      // If an existing file is found, delete it from cloud storage
      if (uploadedUSPLink) {
        await deleteFileFromGCS(uploadedUSPLink);
      }

      // Upload the new file
      uploadedUSPLink = await uploadFileToGCS(req.file, targetFolder);
    }

    // Perform the UPDATE operation
    const eshopResult = await ambarsariyaPool.query(
      `UPDATE Sell.eshop_form
       SET business_name = $1,
           establishment_date = $2,
           usp_values_url = $3,
           product_sample_url = $4,
           upi_id = $5,
           key_players = $6,
           cost_sensitivity = $7,
           daily_walkin = $8,
           parking_availability = $9,
           category = $10,
           advertisement_video_url = $11
       WHERE shop_access_token = $12
       RETURNING shop_access_token`,
      [
        business_name,
        date_of_establishment,
        uploadedUSPLink,
        product_samples,
        encryptedUPI, // Store encrypted UPI ID
        key_players,
        cost_sensitivity,
        daily_walkin,
        parking_availability,
        category,
        advt_video,
        shopAccessToken,
      ]
    );

    if (eshopResult.rows.length === 0) {
      return resp
        .status(404)
        .json({ message: "No e-shop found with the provided access token." });
    }

    resp.status(200).json({
      message: "E-shop data successfully updated.",
      shop_access_token: eshopResult.rows[0].shop_access_token,
    });
  } catch (err) {
    console.error("Error updating data:", err);
    resp
      .status(500)
      .json({ message: "Error updating data", error: err.message });
  }
};

const update_eshop_location = async (req, resp) => {
  const { location_pin_drop, distance_from_pin, shop_access_token } = req.body;

  // Validate input
  if (!shop_access_token) {
    return resp.status(400).json({ message: "Shop access token is required." });
  }
  if (!location_pin_drop || typeof location_pin_drop !== "object") {
    return resp.status(400).json({ message: "Invalid location data." });
  }

  try {
    console.log("Updating e-shop location:", {
      location_pin_drop,
      distance_from_pin,
      shop_access_token,
    });

    const locationPinDropArray = location_pin_drop.map((obj) => JSON.stringify(obj));

    // Perform the UPDATE operation
    const eshopResult = await ambarsariyaPool.query(
      `UPDATE Sell.eshop_form
       SET location_pin_drop = $1::jsonb[], 
           distance_from_pin = $2
       WHERE shop_access_token = $3
       RETURNING *`,
      [
        locationPinDropArray, // Ensure JSON format
        parseFloat(distance_from_pin), // Ensure it's a number
        shop_access_token,
      ]
    );

    // If no rows were affected, return an error
    if (eshopResult.rows.length === 0) {
      return resp.status(404).json({ message: "No e-shop found with the provided access token." });
    }

    resp.status(200).json({
      message: "E-shop location successfully updated.",
      data: eshopResult.rows[0], // Return updated row
    });
  } catch (err) {
    console.error("Error updating e-shop location:", err);
    resp.status(500).json({ message: "Error updating data", error: err.message });
  }
};

const update_shop_is_open_status = async (req, resp) => {
  const { isOpen, shop_access_token } = req.body;

  try {
    const updateResult = await ambarsariyaPool.query(
      `UPDATE Sell.eshop_form
       SET is_open = $1
       WHERE shop_access_token = $2`,
      [isOpen, shop_access_token]
    );

    // Optional: check if row was actually updated
    if (updateResult.rowCount === 0) {
      return resp.status(404).json({ message: "No matching shop found to update." });
    }

    return resp.status(200).json({
      message: "E-shop open status updated successfully.",
      updated: isOpen
    });

  } catch (err) {
    console.error("Error updating e-shop open status:", err);
    return resp.status(500).json({ message: "Server error updating open status.", error: err.message });
  }
};


const get_shopUserData = async (req, res) => {
  try {
    const { shop_access_token } = req.query;

    // Validate that the shop_access_token is provided
    if (!shop_access_token) {
      return res
        .status(400)
        .json({ message: "Shop access token is required." });
    }

    const query = `
            SELECT
    ef.shop_no AS "shop_no",
    ef.user_id AS "user_id",
    u.user_type AS "user_type",
    uc.username AS "username",
    u.title AS "title",
    u.full_name AS "full_name",
    ef.address AS "address",
    u.phone_no_1 AS "phone_no_1",
    u.phone_no_2 AS "phone_no_2",
    ef.domain AS "domain_id",
    d.domain_name AS "domain_name",
    ef.created_domain AS "created_domain",
    ef.sector AS "sector_id",
    s.sector_name AS "sector_name",
    ef.created_sector AS "created_sector",
    ef.ontime AS "ontime", 
    ef.offtime AS "offtime", 
    array_agg(DISTINCT st.service) AS "type_of_service", 
    ef.paid_version AS "paid_version", 
    ef.gst AS "gst",
    ef.msme AS "msme",
    u.pan_no AS "pan_no",
    u.cin_no AS "cin_no",
    ef.is_merchant AS "is_merchant",
    ef.member_username_or_phone_no AS "member_username_or_phone_no",
    ef.premium_service AS "premium_service",
    ef.business_name AS "business_name",
    ef.establishment_date AS "establishment_date", 
    ef.location_pin_drop, 
    ef.distance_from_pin, 
    ef.usp_values_url AS "usp_values_url",
    ef.product_sample_url AS "product_sample_url",
    ef.upi_id AS "upi_id",
    ef.similar_options AS "similar_options",
    -- Fetch similar options names
    (SELECT array_agg(ef2.business_name) 
     FROM Sell.eshop_form ef2 
     WHERE ef2.shop_no = ANY(ef.similar_options)) AS "similar_options_name",
    -- Fetch similar options tokens, casting UUID to TEXT
    (SELECT array_agg(ef2.shop_access_token::TEXT) 
     FROM Sell.eshop_form ef2 
     WHERE ef2.shop_no = ANY(ef.similar_options)) AS "similar_options_token",
    ef.key_players AS "key_players",
    -- Fetch key players names
    (SELECT array_agg(ef2.business_name) 
     FROM Sell.eshop_form ef2 
     WHERE ef2.shop_no = ANY(ef.key_players)) AS "key_players_name",
    -- Fetch key players tokens, casting UUID to TEXT
    (SELECT array_agg(ef2.shop_access_token::TEXT) 
     FROM Sell.eshop_form ef2 
     WHERE ef2.shop_no = ANY(ef.key_players)) AS "key_players_token",
    ef.cost_sensitivity AS "cost_sensitivity",
    ef.daily_walkin AS "daily_walkin",
    ef.parking_availability AS "parking_availability",
    ef.category AS "category",
    array_agg(DISTINCT c.category_name) AS "category_name",  
    ef.advertisement_video_url,
    ef.latitude AS "latitude",
    ef.longitude AS "longitude",
    ef.is_open AS "is_open",
    ef.shop_access_token AS "shop_access_token",
    ef.oauth_access_token AS "oauth_access_token",
    ef.oauth_refresh_token AS "oauth_refresh_token"
FROM Sell.users u
JOIN Sell.eshop_form ef ON ef.user_id = u.user_id
JOIN Sell.user_credentials uc ON uc.user_id = u.user_id
JOIN Sell.user_shops us ON us.user_id = u.user_id
JOIN public.domains d ON d.domain_id = ef.domain
JOIN public.sectors s ON s.sector_id = ef.sector
LEFT JOIN public.type_of_services st ON st.id = ANY(ef.type_of_service)
LEFT JOIN public.categories c ON c.category_id = ANY(ef.category)
WHERE ef.shop_access_token = $1
GROUP BY ef.shop_no, ef.user_id, u.user_type, uc.username, u.title, 
         u.full_name, ef.address, u.phone_no_1, u.phone_no_2, d.domain_name, ef.created_domain, 
         s.sector_name, ef.created_sector, ef.ontime, ef.offtime, ef.paid_version, ef.gst, ef.msme, 
         u.pan_no, u.cin_no, ef.is_merchant, ef.member_username_or_phone_no, 
         ef.premium_service, ef.business_name, ef.establishment_date, ef.usp_values_url, 
         ef.product_sample_url, ef.upi_id, ef.similar_options, ef.key_players, ef.cost_sensitivity, 
         ef.daily_walkin, ef.parking_availability, ef.category, ef.advertisement_video_url, ef.latitude, ef.longitude, ef.shop_access_token, ef.oauth_access_token, ef.oauth_refresh_token;
`;

    const result = await ambarsariyaPool.query(query, [shop_access_token]);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No data found for the provided shop access token." });
    }

    const shopData = result.rows;
    

    // Decrypt UPI ID
    shopData[0].upi_id = shopData[0].upi_id !==null ? decryptData(shopData[0].upi_id) : null;

    res.json(shopData);
  } catch (err) {
    console.error("Error fetching shop user data:", err);
    res
      .status(500)
      .json({ message: "Error fetching shop user data.", error: err.message });
  }
};

const get_memberData = async (req, res) => {
  try {
    const { memberAccessToken } = req.query;

    // Validate that the member_access_token is provided
    if (!memberAccessToken) {
      return res
        .status(400)
        .json({ message: "Member access token is required." });
    }

    const query = `
            SELECT
                u.user_id AS "user_id",
                u.user_type AS "user_type",
                uc.username AS "username",
                u.title AS "title",
                u.full_name AS "full_name",
                u.phone_no_1 AS "phone_no_1",
                u.gender AS "gender",
                mp.dob AS "dob",
                mp.address AS "address",
                mp.latitude ,
                mp.longitude ,
                mp.profile_img ,
                mp.bg_img, mp.oauth_access_token, mp.oauth_refresh_token
            FROM Sell.users u
            JOIN Sell.user_credentials uc ON uc.user_id = u.user_id
            JOIN Sell.member_profiles mp ON mp.user_id = u.user_id
            WHERE uc.access_token = $1`;

    const result = await ambarsariyaPool.query(query, [memberAccessToken]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "No data found for the provided member access token.",
      });
    }

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching user data:", err);
    res
      .status(500)
      .json({ message: "Error fetching user data.", error: err.message });
  }
};

const get_otherShops = async (req, res) => {
  try {
    const { shopAccessToken } = req.query;
    const result = await ambarsariyaPool.query(
      `SELECT * FROM Sell.eshop_form 
                WHERE shop_access_token != $1 AND business_name IS NOT NULL`,
      [shopAccessToken]
    );
    res.json(result.rows);
  } catch (err) {
    console.log("Error fetching sectors : " + err);
    res
      .status(500)
      .json({ message: "Error fetching sectors.", error: err.message });
  }
};

const get_userData = async (req, res) => {
  try {
    const { userAccessToken } = req.query;

    // First check in the users table (for member, merchant, shop)
    const userResult = await ambarsariyaPool.query(
      `SELECT 
        u.user_type, 
        u.user_id, 
        ef.shop_no AS "shop_no",
        ef.shop_access_token AS "shop_access_token",
        uc.access_token AS "user_access_token",
        s.support_id,
        s.visitor_id,
        mp.member_id,
        CASE 
          WHEN u.user_type = 'member' THEN u.full_name
          ELSE ef.business_name
        END AS "name"
      FROM sell.users u
      JOIN sell.user_credentials uc 
        ON u.user_id = uc.user_id
      LEFT join sell.member_profiles mp
      ON mp.user_id = u.user_id
      LEFT JOIN sell.eshop_form ef
        ON u.user_id = ef.user_id
      LEFT JOIN sell.support s
        ON s.access_token = uc.access_token
      WHERE uc.access_token = $1
      AND u.user_type IN ('member', 'merchant', 'shop')`,
      [userAccessToken]
    );

    // If no results, check the support table for visitor
    if (userResult.rows.length === 0) {
      const supportResult = await ambarsariyaPool.query(
        `SELECT 
            user_type,
            support_id, 
            visitor_id, 
            name,
            access_token as "user_access_token" 
        FROM sell.support 
        WHERE access_token = $1`,
        [userAccessToken]
      );

      if (supportResult.rows.length > 0) {
        res.json(supportResult.rows);
      } else {
        res.status(404).json({ message: "User not found." });
      }
    } else {
      res.json(userResult.rows);
    }
  } catch (err) {
    console.log("Error fetching user data: " + err);
    res
      .status(500)
      .json({ message: "Error fetching user data.", error: err.message });
  }
};

const post_authLogin = async (req, res) => {
  const { username, password, type } = req.body;

  // Input validation
  if (!username || !password || !type) {
    return res
      .status(400)
      .json({ message: "Username, password, and type are required." });
  }

  try {
    // Query to find the user credentials by username
    const result = await ambarsariyaPool.query(
      "SELECT * FROM Sell.user_credentials WHERE username = $1",
      [username]
    );

    // If no user found with the given username
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Username not found." });
    }

    // Iterate through all users with that username
    for (let i = 0; i < result.rows.length; i++) {
      const storedPassword = result.rows[i].password;
      const userAccessToken = result.rows[i].access_token;
      const userId = result.rows[i].user_id; // Get user_id

      // Query to get the user type based on user_id
      const userResult = await ambarsariyaPool.query(
        "SELECT user_type FROM Sell.users WHERE user_id = $1",
        [userId]
      );
      const userType = userResult.rows[0]?.user_type;

      // Validate user type based on provided `type`
      const isValidUserType =
        (type === "sell" && (userType === "shop" || userType === "merchant")) ||
        (type === "buy" && (userType === "member" || userType === "visitor"));

      if (!isValidUserType) {
        continue; // Skip this user if the type does not match
      }

      // Compare the provided password with the stored password (hashed)
      const isPasswordValid = await bcrypt.compare(password, storedPassword);

      if (isPasswordValid) {
        // Return the user access token and user type if password matches and type is valid
        return res.status(200).json({
          message: "Login successful.",
          user_access_token: userAccessToken,
          user_type: userType,
        });
      }
    }

    // If no matching credentials were found
    return res.status(401).json({ message: "Incorrect password." });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const get_allShops = async (req, res) => {
  try {
    const result = await ambarsariyaPool.query(`
            SELECT
                ef.shop_no AS "shop_no",
    ef.user_id AS "user_id",
    u.user_type AS "user_type",
    uc.username AS "username",
    u.title AS "title",
    u.full_name AS "full_name",
    ef.address AS "address",
    u.phone_no_1 AS "phone_no_1",
    u.phone_no_2 AS "phone_no_2",
    ef.domain AS "domain_id",
    d.domain_name AS "domain_name",
    ef.created_domain AS "created_domain",
    ef.sector AS "sector_id",
    s.sector_name AS "sector_name",
    ef.created_sector AS "created_sector",
    ef.ontime AS "ontime", 
    ef.offtime AS "offtime", 
    array_agg(st.service) AS "type_of_service", 
    ef.paid_version AS "paid_version", 
    ef.gst AS "gst",
    ef.msme AS "msme",
    u.pan_no AS "pan_no",
    u.cin_no AS "cin_no",
    ef.is_merchant AS "is_merchant",
    ef.member_username_or_phone_no AS "member_username_or_phone_no",
    ef.premium_service AS "premium_service",
    ef.business_name AS "business_name",
    ef.establishment_date AS "establishment_date", 
    ef.usp_values_url AS "usp_values_url",
    ef.product_sample_url AS "product_sample_url",
    ef.similar_options AS "similar_options",
    -- Fetch similar options names
    (SELECT array_agg(ef2.business_name) 
     FROM Sell.eshop_form ef2 
     WHERE ef2.shop_no = ANY(ef.similar_options)) AS "similar_options_name",
    -- Fetch similar options tokens, casting UUID to TEXT
    (SELECT array_agg(ef2.shop_access_token::TEXT) 
     FROM Sell.eshop_form ef2 
     WHERE ef2.shop_no = ANY(ef.similar_options)) AS "similar_options_token",
    ef.key_players AS "key_players",
    -- Fetch key players names
    (SELECT array_agg(ef2.business_name) 
     FROM Sell.eshop_form ef2 
     WHERE ef2.shop_no = ANY(ef.key_players)) AS "key_players_name",
    -- Fetch key players tokens, casting UUID to TEXT
    (SELECT array_agg(ef2.shop_access_token::TEXT) 
     FROM Sell.eshop_form ef2 
     WHERE ef2.shop_no = ANY(ef.key_players)) AS "key_players_token",
    ef.cost_sensitivity AS "cost_sensitivity",
    ef.daily_walkin AS "daily_walkin",
    ef.parking_availability AS "parking_availability",
    ef.category AS "category",
    array_agg(DISTINCT c.category_name) AS "category_name",  
    ef.advertisement_video_url,
    ef.shop_access_token AS "shop_access_token"
            FROM Sell.users u
            JOIN Sell.eshop_form ef ON ef.user_id = u.user_id
            JOIN Sell.user_credentials uc ON uc.user_id = u.user_id
            JOIN Sell.user_shops us ON us.user_id = u.user_id
            JOIN public.domains d ON d.domain_id = ef.domain
            JOIN public.sectors s ON s.sector_id = ef.sector
            LEFT JOIN public.type_of_services st ON st.id = ANY(ef.type_of_service)
            LEFT JOIN public.categories c ON c.category_id = ANY(ef.category)  -- Using ANY for array comparison
            WHERE ef.business_name IS NOT NULL
            GROUP BY 
                ef.shop_no,
                ef.user_id,
                u.user_type,
                uc.username,
                u.title,
                u.full_name,
                ef.address,
                u.phone_no_1,
                u.phone_no_2,
                ef.domain,
                d.domain_name,
                ef.created_domain,
                ef.sector,
                s.sector_name,
                ef.created_sector,
                ef.ontime,
                ef.offtime,
                ef.paid_version,
                ef.gst,
                ef.msme,
                u.pan_no,
                u.cin_no,
                ef.is_merchant,
                ef.member_username_or_phone_no,
                ef.premium_service,
                ef.business_name,
                ef.establishment_date,
                ef.usp_values_url,
                ef.product_sample_url,
                ef.similar_options,
                ef.key_players,
                ef.cost_sensitivity,
                ef.daily_walkin,
                ef.parking_availability,
                ef.category,
                ef.advertisement_video_url,
                ef.shop_access_token;

            `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching domains", err);
    res
      .status(500)
      .json({ message: "Error fetching shops", error: err.message });
  }
};

const get_allUsers = async (req, res) => {
  const { user_type } = req.params;
  try {
    if (user_type === "visitor") {
      const result =
        await ambarsariyaPool.query(`SELECT v.*, d.domain_name, s.sector_name
                FROM Sell.support v
                JOIN domains d ON v.domain_id = d.domain_id
                JOIN sectors s ON v.sector_id = s.sector_id;`);
      res.json(result.rows);
    } else if (user_type === "shop") {
      const result = await ambarsariyaPool.query(
        `SELECT u.*, uc.*, ef.*, d.domain_name, s.sector_name
            FROM Sell.users u
            JOIN sell.eshop_form ef ON ef.user_id = u.user_id
            JOIN Sell.user_credentials uc ON u.user_id = uc.user_id
            JOIN domains d ON ef.domain = d.domain_id
            JOIN sectors s ON ef.sector = s.sector_id
            WHERE u.user_type = $1 AND business_name IS NOT NULL`,
        [user_type]
      );
      res.json(result.rows);
    } else {
      const result = await ambarsariyaPool.query(
        `SELECT u.*, uc.*
            FROM Sell.users u
            JOIN Sell.user_credentials uc ON u.user_id = uc.user_id
            WHERE u.user_type = $1`,
        [user_type]
      );
      res.json(result.rows);
    }
  } catch (e) {
    console.error("Error fetching users", e);
    res.status(500).json({ message: "Error fetching users", error: e.message });
  }
};

const post_visitorData = async (req, resp) => {
  const { name, phone_no, otp } = req.body;

  try {
    // Start a transaction
    await ambarsariyaPool.query("BEGIN");

    // Check if the phone number already exists in the support table
    const existingUser = await ambarsariyaPool.query(
      `SELECT access_token FROM sell.support WHERE phone_no = $1`,
      [phone_no]
    );

    if (existingUser.rows.length > 0) {
      // If phone number exists, return existing access token
      await ambarsariyaPool.query("COMMIT");
      return resp.status(200).json({
        message: "User already exists.",
        access_token: existingUser.rows[0].access_token,
      });
    }

    // Check if the user exists in the users table
    const userResult = await ambarsariyaPool.query(
      `SELECT ef.domain, ef.sector, u.user_type, uc.access_token
            FROM sell.users u 
            LEFT JOIN sell.eshop_form ef ON ef.user_id = u.user_id
            JOIN sell.user_credentials uc ON uc.user_id = u.user_id
            WHERE u.phone_no_1 = $1 OR u.phone_no_2 = $1`,
      [phone_no]
    );

    let newAccessToken = null;

    if (userResult.rows.length > 0) {
      // If the user exists in the users table, store their details in the support table
      const data = userResult.rows[0];

      // Insert the user into the support table with all details
      const insertSupport = await ambarsariyaPool.query(
        `INSERT INTO sell.support (name, phone_no, otp, domain_id, sector_id, user_type, access_token)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING access_token`,
        [name, phone_no, otp, data.domain, data.sector, data.user_type, data.access_token]
      );
      newAccessToken = insertSupport.rows[0].access_token;
    } else {
      // If user does not exist in users table, create a new access token
      const insertSupport = await ambarsariyaPool.query(
        `INSERT INTO sell.support (name, phone_no, otp)
                VALUES ($1, $2, $3)
                RETURNING access_token`,
        [name, phone_no, otp]
      );
      newAccessToken = insertSupport.rows[0].access_token;
    }

    // Commit the transaction
    await ambarsariyaPool.query("COMMIT");

    return resp.status(201).json({
      message: "Form submitted successfully.",
      access_token: newAccessToken,
    });
  } catch (err) {
    await ambarsariyaPool.query("ROLLBACK");
    console.error("Error storing data:", err);
    return resp
      .status(500)
      .json({ message: "Error storing data", error: err.message });
  }
};

const get_visitorData = async (req, res) => {
  try {
    const { token, sender_id } = req.params; // Extract the token from the request

    // Query for full visitor data
    const query = `
           SELECT  
              v.support_id,
              v.visitor_id,
              v.name,
              v.phone_no,
              v.purpose,
              v.message,
              v.file_attached,
              v.user_type,
              v.response,
              v.access_token,
              d.domain_name,
              s.sector_name,
              (
                SELECT json_agg(response_obj)
                FROM (
                  SELECT DISTINCT ON (sc.sender_id)
                    json_build_object(
                      'sender_id', sc.sender_id,
                      'sender_type', sc.sender_type,
                      'sender_response', sc.message,
                      'notification_id', sc.notification_id,
                      'business_name', ef.business_name,
                      'shop_access_token', ef.shop_access_token
                    ) AS response_obj
                  FROM sell.support_chat_messages sc
                  LEFT JOIN sell.eshop_form ef ON ef.shop_no = sc.sender_id
                  WHERE sc.support_id = v.support_id AND sc.sender_id != $2
                  ORDER BY sc.sender_id, sc.sent_at DESC
                ) latest_responses
              ) AS response
            FROM sell.support v
            LEFT JOIN domains d ON d.domain_id = v.domain_id
            LEFT JOIN sectors s ON s.sector_id = v.sector_id
            WHERE v.access_token = $1;
        `;
    const result = await ambarsariyaPool.query(query, [token, sender_id]);

    if (result.rowCount === 0) {
      // If no rows are found, assume the token is invalid
      res.status(404).json({ valid: false, message: "Invalid token" });
    } else {
      res.json({ valid: true, data: result.rows });
    }
  } catch (err) {
    console.error("Error processing request:", err);
    res
      .status(500)
      .json({ message: "Error processing request.", error: err.message });
  }
};


const put_visitorData = async (req, resp) => {
  const { name, phone_no, domain, domain_name, sector, sector_name,sending_from, purpose, message, user_type, access_token } = req.body;
  console.log('Received request to process visitor data', req.body);
  broadcastMessage('Processing visitor\'s data');

  try {
    // Check if there are merchants with the same domain and sector
    const merchantsCheckQuery = await ambarsariyaPool.query(
      `SELECT ef.shop_no, uc.username, uc.user_id
      FROM sell.eshop_form ef 
      JOIN sell.user_credentials uc ON uc.user_id = ef.user_id
      WHERE ef.domain = $1 and ef.sector = $2 and uc.access_token != $3`,
      [domain, sector, access_token]
    );

    if (merchantsCheckQuery.rows.length === 0) {
      const errorMessage = 'No merchants found with the same domain and sector.';
      console.error(errorMessage);
      broadcastMessage(errorMessage);
      return resp.status(400).json({ message: errorMessage });
    }

    let uploadedFile = null;
    const currentfile = req.file ? req.file : null;

    if (currentfile) {
      uploadedFile = await uploadFileToGCS(currentfile, "support_page/file_attached");
      console.log('File uploaded to GCS:', uploadedFile);
      broadcastMessage('File uploaded to GCS');
    }

    // Check if access_token already exists
    const existingRecord = await ambarsariyaPool.query(
      `SELECT visitor_id,support_id, file_attached FROM Sell.support WHERE access_token = $1`,
      [access_token]
    );

    let result;
    let visitor_id = existingRecord.rows.length > 0 ? existingRecord.rows[0].visitor_id : null;
    let support_id = existingRecord.rows.length > 0 ? existingRecord.rows[0].support_id : null;
    let existingFile = null;

    if (existingRecord.rows.length > 0) {
      existingFile = existingRecord.rows[0].file_attached; // Set existingFile only if record exists

      if (existingFile && uploadedFile) {
        await deleteFileFromGCS(existingFile);
        console.log('Old file deleted from GCS:', existingFile);
        broadcastMessage('Old file deleted from GCS');
      }

      result = await ambarsariyaPool.query(
        `UPDATE Sell.support
         SET domain_id = $1,
             sector_id = $2,
             purpose = $3,
             message = $4,
             file_attached = $5,
             updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'
         WHERE access_token = $6
         RETURNING visitor_id, support_id`,
        [domain, sector, purpose, message, uploadedFile || existingFile, access_token]
      );
      console.log('Visitor data updated successfully');
      broadcastMessage('Visitor data updated successfully!');

    } else {
      result = await ambarsariyaPool.query(
        `INSERT INTO Sell.support 
         (name, phone_no, domain_id, sector_id, purpose, message, file_attached, user_type, access_token, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 
                 CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata', 
                 CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
         RETURNING visitor_id, support_id`,
        [name, phone_no, domain, sector, purpose, message, uploadedFile, user_type, access_token]
      );
      console.log('New visitor record created successfully');
      broadcastMessage('New visitor record created successfully!');
      visitor_id = result.rows[0].visitor_id;
      support_id = result.rows[0].support_id;
    }

    if (purpose) {
      console.log(`Purpose is ${purpose}. Notifying merchants...`);
      broadcastMessage('Notifying merchants...');

      const usersQuery = await ambarsariyaPool.query(
        `SELECT ef.shop_no, uc.username, uc.user_id, u.user_type
      FROM sell.eshop_form ef 
      JOIN sell.user_credentials uc ON uc.user_id = ef.user_id
      JOIN sell.users u ON u.user_id = uc.user_id
      WHERE ef.domain = $1 and ef.sector = $2 and uc.access_token != $3`,
        [domain, sector, access_token]
      );

      if (usersQuery.rows.length > 0) {
        console.log('Merchants to be notified:', usersQuery.rows);

        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        for (let user of usersQuery.rows) {
          console.log(support_id);
          
          // Determine the link to the file, either new or existing
          const fileLink = uploadedFile || existingFile
            ? `You can view the file here: ${uploadedFile || existingFile}`
            : 'No file attached';

          const mailOptions = {
            from: process.env.SMTP_USER,
            to: user.username,
            subject: 'New Buyer Inquiry',
            text: `Hello ${user.username},

A new user has shown interest in buying something from your store.

Details:
- Name: ${name}
- Domain: ${domain_name}
- Sector: ${sector_name}
- User Type: ${user_type}
- Phone No: ${phone_no}
- Purpose: ${purpose}
- Message: ${message}
- File: ${fileLink}

Please review the inquiry and take appropriate action.
https://ambarsariya-emall-frontend.vercel.app/AmbarsariyaMall/sell/support

Best regards,
Your Support Team`,
          };

          try {
            // Insert into support_chat_notifications and return the notification_id
            const notificationResult = await ambarsariyaPool.query(
              `INSERT INTO sell.support_chat_notifications 
                (domain_id, sector_id, visitor_id, sent_to, sent_from, purpose, message, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
              RETURNING id`,
              [domain, sector, visitor_id, user.shop_no, sending_from, purpose, message]
            );

            const notification_id = notificationResult.rows[0].id;

            // Send the email
            await transporter.sendMail(mailOptions);
            console.log(`Email sent to merchant: ${user.username}`);
            broadcastMessage('Email sent to merchants.');

            // Insert the corresponding chat message
            await ambarsariyaPool.query(
              `INSERT INTO Sell.support_chat_messages (
                visitor_id, notification_id, support_id, sender_id, sender_type, 
                receiver_id, receiver_type, message, sent_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'
              )`,
              [
                visitor_id,
                notification_id,
                support_id,
                sending_from,
                user_type,
                user.shop_no,
                'shop',
                  `Name: ${name}, Domain: ${domain_name}, Sector: ${sector_name}, User Type: ${user_type}, Phone No: ${phone_no}, Purpose: ${purpose}, Message: ${message}, File: ${fileLink}`,
              ]
            );


          } catch (error) {
            console.error(`Error sending email to ${user.username}:`, error);
            broadcastMessage('Error sending email to merchants.');
          }
        }
      } else {
        console.log('No merchants found with the same domain and sector.');
        broadcastMessage('No merchants found with the same domain and sector.');
      }
    } 
    // else {
    //   console.log('No email will be sent.');
    //   broadcastMessage('Purpose is not "buy". No email will be sent.');
    // }

    resp.status(200).json({
      message: existingRecord.rows.length > 0
        ? "Visitor data updated successfully."
        : "New visitor record created successfully.",
      visitor_access_token: visitor_id,
    });
  } catch (err) {
    console.error("Error processing visitor data:", err);
    resp.status(500).json({
      message: "Error processing visitor data",
      error: err.message,
    });
  }
};

const patch_supportChatResponse = async (req, resp) => {
  const { support_id } = req.params;
  const response = req.body;  // The new response object

  console.log(response);

  const responseArray = [response];  // This will ensure it's an array of JSON objects

  try {
    // Ensure response is in the correct format as a JSONB array
    const result = await ambarsariyaPool.query(
      `UPDATE sell.support
       SET response = 
         CASE
           WHEN response IS NULL THEN $1::jsonb[]
           ELSE response || $1::jsonb[]
         END
       WHERE support_id = $2
       RETURNING *`,
      [responseArray, support_id]  // Pass the response array directly (without JSON.stringify)
    );

    resp.json({ valid: true, data: result.rows[0], message:'Response submitted' });
  } catch (error) {
    console.error(error);
    resp.status(500).json({ valid: false, error: "Failed to update response" });
  }
};

const post_supportChatMessage = async (req, res) => {
  const { data } = req.body;
  console.log(data);

  const {
    visitor_id,
    notification_id,
    support_id,
    sender_id,
    sender_type,
    receiver_id,
    receiver_type,
    message,
  } = data;

  try {
    await ambarsariyaPool.query("BEGIN"); // Start transaction

    const chatQuery = `
      INSERT INTO Sell.support_chat_messages (
        visitor_id, notification_id, support_id, sender_id, sender_type, 
        receiver_id, receiver_type, message, sent_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'
      )
      RETURNING id
    `;

    const chatRequest = await ambarsariyaPool.query(chatQuery, [
      visitor_id,
      notification_id,
      support_id,
      sender_id,
      sender_type,
      receiver_id,
      receiver_type,
      message,
    ]);

    if (sender_id !== visitor_id) {
      await ambarsariyaPool.query(`
        UPDATE Sell.support
        SET response = true
        WHERE support_id = $1
      `, [support_id]);
    }

    await ambarsariyaPool.query("COMMIT");

    emitChatMessage(support_id, {
      ...data,
      chat_id: chatRequest.rows[0].id,
      sent_at: new Date().toISOString(),
    });

    res.status(201).json({
      message: "Chat created successfully",
      chat_id: chatRequest.rows[0].id,
    });
  } catch (err) {
    await ambarsariyaPool.query("ROLLBACK");
    console.error("Error inserting chat message:", err);
    res.status(400).json({
      error: "Message failed",
      message: err.message,
    });
  }
};

const get_supportChatMessages = async (req, res) => {
  try {
    const { support_id, notification_id } = req.params; // Extract the shop_no from the request

    // Query for full visitor data
    const query = `
          SELECT 
              scm.id,
              scm.visitor_id,
              scm.notification_id,
              scm.support_id,
              scm.sender_id,
              scm.sender_type,
              scm.receiver_id,
              scm.receiver_type,
              scm.message,
              scm.sent_at,
              scm.is_read,
              scn.domain_id,
              scn.sector_id,
              scn.purpose,
              sc.name AS visitor_name,
              sc.phone_no,
              sc.file_attached,

              CASE 
                  WHEN scm.sender_type = 'member' THEN ru.full_name
                  WHEN scm.sender_type = 'shop' THEN ef.poc_name
                  WHEN scm.sender_type = 'visitor' THEN rv.name
              END AS receiver_name

          FROM sell.support_chat_messages scm
          JOIN sell.support_chat_notifications scn
            ON scn.id = scm.notification_id AND scn.visitor_id = scm.visitor_id
          JOIN sell.support sc
            ON sc.visitor_id = scm.visitor_id

          LEFT JOIN sell.member_profiles rmp ON scm.sender_type = 'member' AND rmp.member_id = scm.sender_id
          LEFT JOIN sell.users ru ON ru.user_id = rmp.user_id
          LEFT JOIN sell.eshop_form ef ON scm.sender_type = 'shop' AND ef.shop_no = scm.sender_id
          LEFT JOIN sell.support rv ON scm.sender_type = 'visitor' AND rv.visitor_id = scm.sender_id
          WHERE scm.support_id = $1 AND scm.notification_id = $2
          ORDER BY scm.sent_at ASC;
        `;
    const result = await ambarsariyaPool.query(query, [support_id, notification_id]);

    if (result.rowCount === 0) {
      // If no rows are found, assume the token is invalid
      res.status(404).json({ valid: false, message: "Invalid support id or notificaiton id" });
    } else {
      res.json({ valid: true, data: result.rows });
    }
  } catch (err) {
    console.error("Error processing request:", err);
    res
      .status(500)
      .json({ message: "Error processing request.", error: err.message });
  }
};

const get_supportChatNotifications = async (req, res) => {
  try {
    const { shop_no } = req.params; // Extract the shop_no from the request

    // Query for full visitor data
    const query = `
            SELECT scn.id, 
                scn.created_at as notification_received_at, 
                s.*, scn.sent_to,scn.sent_from, 
                scn.message as notification, 
                scn.purpose as notification_purpose,
                d.domain_name,
                sectors.sector_name
            FROM sell.support_chat_notifications scn
            JOIN sell.support s
            ON s.visitor_id = scn.visitor_id
            JOIN domains d
            ON d.domain_id = scn.domain_id
            JOIN sectors sectors
            ON sectors.sector_id = scn.sector_id
            WHERE scn.sent_to = $1
        `;
    const result = await ambarsariyaPool.query(query, [shop_no]);

    if (result.rowCount === 0) {
      // If no rows are found, assume the token is invalid
      res.status(404).json({ valid: false, message: "Invalid shop number" });
    } else {
      res.json({ valid: true, data: result.rows });
    }
  } catch (err) {
    console.error("Error processing request:", err);
    res
      .status(500)
      .json({ message: "Error processing request.", error: err.message });
  }
};

const delete_supportChatNotifications = async (req, res) => {
  const { id } = req.params;

  try {
    await ambarsariyaPool.query("DELETE FROM sell.support_chat_notifications WHERE id = $1", [id]);
    res.json({ message: "Notification deleted successfully" });
  } catch (err) {
    console.error("Error deleting notification:", err);
    res.status(500).json({ error: "Failed to delete message" });
  }
}

const put_forgetPassword = async (req, resp) => {
  const { username, password, user_type } = req.body;
console.log(user_type);

  try {
    // Determine allowed user types based on the user_type
    let allowedUserTypes = [];
    if (user_type === "sell") {
      allowedUserTypes = ["shop", "merchant"];
    } else if (user_type === "buy") {
      allowedUserTypes = ["member", "visitor"];
    } else {
      return resp.status(400).json({ message: "Invalid user_type provided." });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password for the specific user
    const result = await ambarsariyaPool.query(
      `
            UPDATE sell.user_credentials
            SET password = $2
            WHERE username = $1
            AND user_id IN (
                SELECT user_id
                FROM sell.users
                WHERE user_type = ANY($3::text[])
            )
            RETURNING access_token
            `,
      [username, hashedPassword, allowedUserTypes]
    );

    if (result.rows.length === 0) {
      return resp.status(404).json({ message: "No user found." });
    }

    const user_access_token = result.rows[0].access_token;

    resp.status(200).json({
      message: "Password updated successfully.",
      user_access_token,
    });
  } catch (err) {
    console.error("Error updating data:", err);
    resp
      .status(500)
      .json({ message: "Error updating data", error: err.message });
  }
};

const post_verify_otp = async (req, res) => {
  const { username, otp, user_type } = req.body;  // Ensure that 'user_type' is passed in the request body

  try {
    // Corrected SQL query to SELECT from the database
    const query = `SELECT uc.* 
                   FROM sell.user_credentials uc 
                   JOIN sell.users u ON u.user_id = uc.user_id 
                   WHERE uc.username = $1 
                   AND u.user_type = $2
                   ORDER BY uc.otp_created_at DESC LIMIT 1`;

    // Fetch OTP record from the database
    const result = await ambarsariyaPool.query(query, [username, user_type]);

    if (result.rows.length === 0) {
      return res.status(400).send({ message: 'OTP not found.' });
    }

    const otpRecord = result.rows[0];

     // Get current UTC time
    let nowUtc = new Date();

    // Convert UTC to IST (Add 5 hours 30 minutes)
    let nowIST = new Date(nowUtc.getTime() + (5.5 * 60 * 60 * 1000));

    // Convert stored UTC time (created_otp_at & expiry_otp_at) to IST
    let otpCreatedIST = new Date(new Date(otpRecord.otp_created_at).getTime() + (5.5 * 60 * 60 * 1000));
    let otpExpiryIST = new Date(new Date(otpRecord.otp_expiry_at).getTime() + (5.5 * 60 * 60 * 1000));

    console.log("Current IST Time:", nowIST.toISOString());
    console.log("OTP Created Time (IST):", otpCreatedIST.toISOString());
    console.log("OTP Expiry Time (IST):", otpExpiryIST.toISOString());

    // Check if OTP is expired
    if (nowIST > otpExpiryIST) {
      return res.status(400).send({ message: 'OTP has expired. Request a new one.' });
    }

    // Check if OTP is valid
    if (otpRecord.otp !== otp) {
      return res.status(400).send({ message: 'Invalid OTP.' });
    }

    // Additional check: OTP creation time should not be in the future
    if (nowIST < otpCreatedIST) {
      return res.status(400).send({ message: 'OTP creation time is invalid.' });
    }

    res.status(200).send({ message: 'OTP verified successfully.' });

    // Optionally, delete OTP record after successful verification
    // await pool.query('DELETE FROM otp_validations WHERE id = $1', [otpRecord.id]);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Error verifying OTP.' });
  }
};

// const post_discount_coupons = async (req, res) => {
//     const shop_no = req.params.shop_no;
//     const { validity_start, validity_end, data } = req.body;  // Extract validity_start and validity_end

//     try {
//       // Start the transaction
//       await ambarsariyaPool.query('BEGIN');

//       // Loop through the categories in the request body
//       for (const [category, categoryData] of Object.entries(data)) {
//         const { id, discounts } = categoryData;

//         // Loop through the discounts in the category
//         for (const [discountType, discountDetails] of Object.entries(discounts)) {
//           if (discountDetails.checked) {
//             // Step 1: Check if the coupon already exists for the shop_no and coupon_type
//             const checkCouponQuery = `
//               SELECT id
//               FROM sell.discount_coupons
//               WHERE coupon_type = $1 AND shop_no = $2;
//             `;
//             const { rows: existingCoupon } = await ambarsariyaPool.query(checkCouponQuery, [
//               discountType,
//               shop_no,
//             ]);

//             let couponId;

//             if (existingCoupon.length > 0) {
//               // If coupon exists, update the coupon with new validity dates
//               couponId = existingCoupon[0].id;
//               const updateCouponQuery = `
//                 UPDATE sell.discount_coupons
//                 SET validity_start = $1, validity_end = $2
//                 WHERE id = $3;
//               `;
//               await ambarsariyaPool.query(updateCouponQuery, [
//                 validity_start,  // Use validity_start from the request
//                 validity_end,    // Use validity_end from the request
//                 couponId,
//               ]);
//             } else {
//               // If coupon does not exist, insert a new coupon
//               const insertCouponQuery = `
//                 INSERT INTO sell.discount_coupons (coupon_type, discount_category, shop_no, validity_start, validity_end)
//                 VALUES ($1, $2, $3, $4, $5)
//                 RETURNING id;
//               `;
//               const { rows } = await ambarsariyaPool.query(insertCouponQuery, [
//                 discountType,
//                 category,
//                 shop_no,
//                 validity_start,  // Use validity_start from the request
//                 validity_end,    // Use validity_end from the request
//               ]);
//               couponId = rows[0].id;
//             }

//             // Step 2: Insert conditions into discount_conditions table
//             const conditions = [];

//             // Collect conditions from discountDetails
//             if (discountDetails.value_1) {
//               conditions.push({
//                 condition_type: 'value_1',
//                 condition_value: discountDetails.value_1,
//               });
//             }
//             if (discountDetails.value_2) {
//               conditions.push({
//                 condition_type: 'value_2',
//                 condition_value: discountDetails.value_2,
//               });
//             }

//             // Insert each condition
//             for (const condition of conditions) {
//               const insertConditionQuery = `
//                 INSERT INTO sell.discount_conditions (coupon_id, condition_type, condition_value)
//                 VALUES ($1, $2, $3);
//               `;
//               await ambarsariyaPool.query(insertConditionQuery, [
//                 couponId,
//                 condition.condition_type,
//                 condition.condition_value,
//               ]);
//             }
//           }
//         }
//       }

//       // Commit the transaction
//       await ambarsariyaPool.query('COMMIT');
//       res.status(201).json({ message: 'Discount coupons and conditions added/updated successfully' });
//     } catch (error) {
//       // Rollback the transaction in case of error
//       await ambarsariyaPool.query('ROLLBACK');
//       console.error('Error inserting discount data:', error);
//       res.status(500).json({ error: 'Failed to add/update discount data' });
//     } finally {
//       // Release the pool connection
//       ambarsariyaPool.end();
//     }
//   };

const post_discount_coupons = async (req, res) => {
  const inputData = req.body;
  const shopNo = req.params.shop_no;

  // Validate the input data structure
  if (!inputData || typeof inputData !== "object") {
    return res.status(400).json({ error: "Invalid input data" });
  }

  if (!inputData.data || typeof inputData.data !== "object") {
    return res.status(400).json({ error: "Invalid category data" });
  }

  if (!shopNo) {
    return res.status(400).json({ error: "Shop number (shop_no) is required" });
  }

  try {
    await ambarsariyaPool.query("BEGIN");

    for (const [category, data] of Object.entries(inputData.data)) {
      if (
        !data ||
        !data.id ||
        !data.discounts ||
        typeof data.discounts !== "object"
      ) {
        continue; // Skip categories with missing or invalid data
      }

      const { discounts, no_of_coupons } = data;

      for (const [couponType, discountData] of Object.entries(discounts)) {
        if (!discountData.checked) continue;
        console.log('discountData : ', discountData);
        

        // Ensure the date_range is valid, if not set default values
        const validityStart = inputData.validity_start || "2024-01-01"; // Default to a specific start date if missing
        const validityEnd = inputData.validity_end || "2024-12-31"; // Default to a specific end date if missing

        // Check if date_range values are still missing and return an error if so
        if (!validityStart || !validityEnd) {
          return res
            .status(400)
            .json({ error: "Validity start and end dates are required" });
        }

        const couponQuery = `
            INSERT INTO sell.discount_coupons (coupon_type, discount_category, shop_no, validity_start, validity_end, no_of_coupons)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (coupon_type, shop_no)
            DO UPDATE SET 
                validity_start = EXCLUDED.validity_start,
                validity_end = EXCLUDED.validity_end
            RETURNING id;
          `;

        // Use shopNo instead of the undefined shop_no variable
        const couponResult = await ambarsariyaPool.query(couponQuery, [
          couponType,
          category,
          shopNo, // Use shopNo here
          validityStart,
          validityEnd,
          no_of_coupons
        ]);

        const couponId = couponResult.rows[0].id;

        const conditionInsertQuery = `
            INSERT INTO sell.discount_conditions (coupon_id, condition_type, condition_value)
            VALUES ($1, $2, $3)
            ON CONFLICT (coupon_id, condition_type)
            DO UPDATE SET 
                condition_value = EXCLUDED.condition_value;
          `;

        const conditions = [];

        for (const [key, value] of Object.entries(discountData)) {
          if (key !== "checked" && key !== "date_range" && value) {
            conditions.push({ type: key, value });
          }
        }

        for (const condition of conditions) {
          await ambarsariyaPool.query(conditionInsertQuery, [
            couponId,
            condition.type,
            condition.value,
          ]);
        }
      }
    }

    await ambarsariyaPool.query("COMMIT");
    res.status(200).json({ message: "Discounts upserted successfully" });
  } catch (error) {
    await ambarsariyaPool.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Failed to upsert discounts" });
  }
};

const get_discountCoupons = async (req, res) => {
  const shopNo = req.params.shop_no;

  try {
    const query = `
        SELECT 
            c.id AS coupon_id,
            c.coupon_type,
            c.discount_category,
            c.shop_no,
            d.condition_type,
            d.condition_value
        FROM 
            sell.discount_coupons c
        JOIN 
            sell.discount_conditions d ON c.id = d.coupon_id
        WHERE c.shop_no=$1
        ORDER BY 
            c.id, d.condition_type;
        `;
    const result = await ambarsariyaPool.query(query, [shopNo]);

    if (result.rowCount === 0) {
      // If no rows are found, return an invalid response
      res.status(404).json({ valid: false, message: "Invalid shop" });
      return;
    }

    // Grouping Logic
    const groupedData = result.rows.reduce((acc, row) => {
      let category = acc.find(
        (c) => c.discount_category === row.discount_category
      );
      if (!category) {
        category = {
          discount_category: row.discount_category,
          shop_no: row.shop_no,
          coupons: [],
        };
        acc.push(category);
      }

      let coupon = category.coupons.find((c) => c.coupon_id === row.coupon_id);
      if (!coupon) {
        coupon = {
          coupon_id: row.coupon_id,
          coupon_type: row.coupon_type,
          conditions: [],
        };
        category.coupons.push(coupon);
      }

      coupon.conditions.push({
        type: row.condition_type,
        value: row.condition_value,
      });

      return acc;
    }, []);

    // Send grouped data
    res.json({ valid: true, data: groupedData });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch discounts" });
  }
};

const get_nearby_shops = async (req, res) => {
  const { token } = req.params;

  try {
    // 1. Get the area
    const areaResult = await ambarsariyaPool.query(
      `SELECT * FROM admin.famous_areas WHERE access_token = $1`,
      [token]
    );

    if (areaResult.rows.length === 0) {
      return res.status(404).json({ error: "Area not found" });
    }

    const area = areaResult.rows[0];
    const { latitude, longitude, length_in_km, near_by_shops } = area;

    // 2. Shops from formula (distance)
    const formulaShopsRes = await ambarsariyaPool.query(
      `SELECT shop_no, shop_access_token
       FROM sell.eshop_form
       WHERE 
         (6371 * acos(
           cos(radians($1)) * cos(radians(latitude)) * 
           cos(radians(longitude) - radians($2)) + 
           sin(radians($1)) * sin(radians(latitude))
         )) <= $3
       ORDER BY shop_no`,
      [latitude, longitude, length_in_km]
    );

    const formulaShops = formulaShopsRes.rows;

    // 3. Shops from near_by_shops JSONB array
    let jsonbShops = [];

    if (Array.isArray(near_by_shops) && near_by_shops.length > 0) {
      const jsonbShopsRes = await ambarsariyaPool.query(
        `SELECT shop_no, shop_access_token
         FROM sell.eshop_form
         WHERE shop_no = ANY($1::text[])`,
        [near_by_shops]
      );
      jsonbShops = jsonbShopsRes.rows;
    }

    // 4. Merge both lists without duplicates
    const combinedMap = new Map();
    [...formulaShops, ...jsonbShops].forEach((shop) => {
      combinedMap.set(shop.shop_no, shop); // use shop_no to avoid duplicates
    });

    const allShops = Array.from(combinedMap.values());

    // 5. Return
    res.json({ ...area, shops: allShops });
  } catch (err) {
    console.error("Error fetching nearby shops:", err);
    res.status(500).json({ error: "Server error" });
  }
};


const get_nearby_areas_for_shop = async (req, res) => {
  const { shopToken, shop_no } = req.params;

  try {
    // 1. Get shop location
    const shopRes = await ambarsariyaPool.query(
      `SELECT latitude, longitude FROM sell.eshop_form WHERE shop_access_token = $1`,
      [shopToken]
    );

    if (shopRes.rows.length === 0) {
      return res.status(404).json({ error: "Shop not found" });
    }

    const { latitude, longitude } = shopRes.rows[0];

    // 2. Try finding areas by formula (within radius)
    const areaRes = await ambarsariyaPool.query(
      `SELECT * FROM admin.famous_areas
       WHERE (6371 * acos(
          cos(radians($1)) * cos(radians(latitude)) * 
          cos(radians(longitude) - radians($2)) + 
          sin(radians($1)) * sin(radians(latitude))
       )) <= length_in_km`,
      [latitude, longitude]
    );

    // 3. If areas found by formula, return them
    if (areaRes.rows.length > 0) {
      return res.json(areaRes.rows);
    }

    // 4. If not, check near_by_shops JSONB array manually
    const nearbyByJsonRes = await ambarsariyaPool.query(
      `SELECT * FROM admin.famous_areas 
       WHERE near_by_shops @> $1::jsonb`,
      [`["${shop_no}"]`]
    );

    if (nearbyByJsonRes.rows.length > 0) {
      return res.json(nearbyByJsonRes.rows);
    }

    // 5. Nothing found — return empty array
    res.json([]);
  } catch (err) {
    console.error("Error in get_nearby_areas_for_shop:", err);
    res.status(500).json({ error: "Server error" });
  }
};


const post_member_emotional = async (req, res) => {
  const { member_id } = req.params;
  const {
    emotional_range_joy_to_excitement,
    emotional_range_sadness_to_anger,
    emotional_reactivity_like_advice,
    emotional_reactivity_share_experiences,
    emotional_regulations_recall_adverse_emotions,
    emotional_regulations_control_anger_and_crying,
    mental_resolution_date,
    mental_resolution_time,
    mental_resolution_message,
    notify_mental_resolution
  } = req.body.data;

  try {
    await ambarsariyaPool.query("BEGIN");

    const upsertQuery = `
      INSERT INTO sell.member_emotional (
        member_id,
        emotional_range_joy_to_excitement,
        emotional_range_sadness_to_anger,
        emotional_reactivity_like_advice,
        emotional_reactivity_share_experiences,
        emotional_regulations_recall_adverse_emotions,
        emotional_regulations_control_anger_and_crying,
        mental_resolution_date,
        mental_resolution_time,
        mental_resolution_message,
        notify_mental_resolution
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11
      )
      ON CONFLICT (member_id)
      DO UPDATE SET
        emotional_range_joy_to_excitement = EXCLUDED.emotional_range_joy_to_excitement,
        emotional_range_sadness_to_anger = EXCLUDED.emotional_range_sadness_to_anger,
        emotional_reactivity_like_advice = EXCLUDED.emotional_reactivity_like_advice,
        emotional_reactivity_share_experiences = EXCLUDED.emotional_reactivity_share_experiences,
        emotional_regulations_recall_adverse_emotions = EXCLUDED.emotional_regulations_recall_adverse_emotions,
        emotional_regulations_control_anger_and_crying = EXCLUDED.emotional_regulations_control_anger_and_crying,
        mental_resolution_date = EXCLUDED.mental_resolution_date,
        mental_resolution_time = EXCLUDED.mental_resolution_time,
        mental_resolution_message = EXCLUDED.mental_resolution_message,
        notify_mental_resolution = EXCLUDED.notify_mental_resolution;
    `;

    const values = [
      member_id,
      emotional_range_joy_to_excitement,
      emotional_range_sadness_to_anger,
      emotional_reactivity_like_advice,
      emotional_reactivity_share_experiences,
      emotional_regulations_recall_adverse_emotions,
      emotional_regulations_control_anger_and_crying,
      mental_resolution_date,
      mental_resolution_time,
      mental_resolution_message,
      notify_mental_resolution
    ];

    await ambarsariyaPool.query(upsertQuery, values);

    await ambarsariyaPool.query("COMMIT");

    res.status(200).json({ message: "Data saved successfully." });
  } catch (error) {
    await ambarsariyaPool.query("ROLLBACK");
    console.error("Error saving emotional data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const get_member_emotional = async (req, res) => {
  try {
    const { member_id } = req.params; // Extract the shop_no from the request

    // Query for full visitor data
    const query = `
            SELECT *
            FROM sell.member_emotional
            WHERE member_id = $1
        `;
    const result = await ambarsariyaPool.query(query, [member_id]);

    if (result.rowCount === 0) {
      // If no rows are found, assume the token is invalid
      res.status(404).json({ valid: false, message: "Invalid member id" });
    } else {
      res.json({ valid: true, data: result.rows });
    }
  } catch (err) {
    console.error("Error processing request:", err);
    res
      .status(500)
      .json({ message: "Error processing request.", error: err.message });
  }
};

// const post_member_personal = async (req, resp) => {
//   console.log("Received files:", req.files["personal_traits_file"]);
//   const { member_id } = req.params;
//   const {
//     personal_traits,
//     hobby_and_interests,
//     goals_and_aspirations,
//     favorite_quotes_or_mottos,
//     values_and_beliefs,
//     life_philosophy,
//     background_information,
//     unique_personal_facts,
//   } = req.body;

//   // Map input fields to their GCS folder
//   const fileTraitMap = {
//     personal_traits_file: "personal_traits",
//     hobby_and_interests_file: "hobbies_and_interests",
//     goals_and_aspirations_file: "goal_and_aspirations",
//     favorite_quotes_or_mottos_file: "favorite_quotes_and_mottos",
//     values_and_beliefs_file: "values_and_beliefs",
//     life_philosophy_file: "life_philosophy",
//     background_information_file: "background_information",
//     unique_personal_facts_file: "unique_personal_facts",
//   };

//   const uploadedFiles = {};

//   try {
//     await ambarsariyaPool.query("BEGIN");

//     // Check if record exists
//     const existingRecordRes = await ambarsariyaPool.query(
//       `SELECT * FROM sell.member_personal WHERE member_id = $1`,
//       [member_id]
//     );

//     const recordExists = existingRecordRes.rows.length > 0;
//     const existingData = recordExists ? existingRecordRes.rows[0] : null;

//     // Handle file upload + deletion
//     for (const [formKey, folderName] of Object.entries(fileTraitMap)) {
//       const file = req.files?.[formKey]?.[0];

//       if (file) {
//         const existingFilePath = existingData?.[`${formKey}`];
//         if (existingFilePath) {
//           await deleteFileFromGCS(existingFilePath);
//         }

//         const newPath = await uploadFileToGCS(file, `member/${folderName}`);
//         uploadedFiles[`${formKey}`] = newPath;
//       } else {
//         uploadedFiles[`${formKey}`] = existingData?.[`${formKey}`] || null;
//       }
//     }

//     // Now either insert or update
//     if (recordExists) {
//       await ambarsariyaPool.query(
//         `UPDATE sell.member_personal SET
//           personal_traits = $1,
//           personal_traits_file = $2,
//           hobbies_and_interests = $3,
//           hobbies_and_interests_file = $4,
//           goal_and_aspirations = $5,
//           goal_and_aspirations_file = $6,
//           favorite_quotes_and_mottos = $7,
//           favorite_quotes_and_mottos_file = $8,
//           values_and_beliefs = $9,
//           values_and_beliefs_file = $10,
//           life_philosophy = $11,
//           life_philosophy_file = $12,
//           background_information = $13,
//           background_information_file = $14,
//           unique_personal_facts = $15,
//           unique_personal_facts_file = $16
//         WHERE member_id = $17`,
//         [
//           personal_traits,
//           uploadedFiles.personal_traits_file,
//           hobby_and_interests,
//           uploadedFiles.hobby_and_interests_file,
//           goals_and_aspirations,
//           uploadedFiles.goals_and_aspirations_file,
//           favorite_quotes_or_mottos,
//           uploadedFiles.favorite_quotes_or_mottos_file,
//           values_and_beliefs,
//           uploadedFiles.values_and_beliefs_file,
//           life_philosophy,
//           uploadedFiles.life_philosophy_file,
//           background_information,
//           uploadedFiles.background_information_file,
//           unique_personal_facts,
//           uploadedFiles.unique_personal_facts_file,
//           member_id,
//         ]
//       );
//     } else {
//       await ambarsariyaPool.query(
//         `INSERT INTO sell.member_personal (
//           member_id,
//           personal_traits,
//           personal_traits_file,
//           hobbies_and_interests,
//           hobbies_and_interests_file,
//           goal_and_aspirations,
//           goal_and_aspirations_file,
//           favorite_quotes_and_mottos,
//           favorite_quotes_and_mottos_file,
//           values_and_beliefs,
//           values_and_beliefs_file,
//           life_philosophy,
//           life_philosophy_file,
//           background_information,
//           background_information_file,
//           unique_personal_facts,
//           unique_personal_facts_file
//         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
//         [
//           member_id,
//           personal_traits,
//           uploadedFiles.personal_traits_file,
//           hobby_and_interests,
//           uploadedFiles.hobby_and_interests_file,
//           goals_and_aspirations,
//           uploadedFiles.goals_and_aspirations_file,
//           favorite_quotes_or_mottos,
//           uploadedFiles.favorite_quotes_or_mottos_file,
//           values_and_beliefs,
//           uploadedFiles.values_and_beliefs_file,
//           life_philosophy,
//           uploadedFiles.life_philosophy_file,
//           background_information,
//           uploadedFiles.background_information_file,
//           unique_personal_facts,
//           uploadedFiles.unique_personal_facts_file,
//         ]
//       );
//     }

//     await ambarsariyaPool.query("COMMIT");

//     resp.status(201).json({
//       message: recordExists ? "Details updated successfully." : "Details stored successfully.",
//     });
//   } catch (err) {
//     await ambarsariyaPool.query("ROLLBACK");
//     console.error("Error storing data", err);
//     resp.status(500).json({ message: "Error storing data", error: err.message });
//   }
// };


const post_member_personal = async (req, resp) => {
  const { member_id } = req.params;
  const {
    personal_traits,
    personal_traits_file,
    hobbies_and_interests,
    hobbies_and_interests_file,
    goal_and_aspirations,
    goal_and_aspirations_file,
    favorite_quotes_and_mottos,
    favorite_quotes_and_mottos_file,
    values_and_beliefs,
    values_and_beliefs_file,
    life_philosophy,
    life_philosophy_file,
    background_information,
    background_information_file,
    unique_personal_facts,
    unique_personal_facts_file,
  } = req.body;

  if (!member_id) {
    return resp.status(400).json({ message: "member_id is required." });
  }

  try {
    await ambarsariyaPool.query("BEGIN");

    await ambarsariyaPool.query(
      `
      INSERT INTO sell.member_personal (
        member_id,
        personal_traits,
        personal_traits_file,
        hobbies_and_interests,
        hobbies_and_interests_file,
        goal_and_aspirations,
        goal_and_aspirations_file,
        favorite_quotes_and_mottos,
        favorite_quotes_and_mottos_file,
        values_and_beliefs,
        values_and_beliefs_file,
        life_philosophy,
        life_philosophy_file,
        background_information,
        background_information_file,
        unique_personal_facts,
        unique_personal_facts_file
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (member_id)
      DO UPDATE SET
        personal_traits = EXCLUDED.personal_traits,
        personal_traits_file = EXCLUDED.personal_traits_file,
        hobbies_and_interests = EXCLUDED.hobbies_and_interests,
        hobbies_and_interests_file = EXCLUDED.hobbies_and_interests_file,
        goal_and_aspirations = EXCLUDED.goal_and_aspirations,
        goal_and_aspirations_file = EXCLUDED.goal_and_aspirations_file,
        favorite_quotes_and_mottos = EXCLUDED.favorite_quotes_and_mottos,
        favorite_quotes_and_mottos_file = EXCLUDED.favorite_quotes_and_mottos_file,
        values_and_beliefs = EXCLUDED.values_and_beliefs,
        values_and_beliefs_file = EXCLUDED.values_and_beliefs_file,
        life_philosophy = EXCLUDED.life_philosophy,
        life_philosophy_file = EXCLUDED.life_philosophy_file,
        background_information = EXCLUDED.background_information,
        background_information_file = EXCLUDED.background_information_file,
        unique_personal_facts = EXCLUDED.unique_personal_facts,
        unique_personal_facts_file = EXCLUDED.unique_personal_facts_file
      `,
      [
        member_id,
        personal_traits,
        personal_traits_file,
        hobbies_and_interests,
        hobbies_and_interests_file,
        goal_and_aspirations,
        goal_and_aspirations_file,
        favorite_quotes_and_mottos,
        favorite_quotes_and_mottos_file,
        values_and_beliefs,
        values_and_beliefs_file,
        life_philosophy,
        life_philosophy_file,
        background_information,
        background_information_file,
        unique_personal_facts,
        unique_personal_facts_file,
      ]
    );

    await ambarsariyaPool.query("COMMIT");

    resp.status(201).json({ message: "Details stored or updated successfully." });
  } catch (err) {
    await ambarsariyaPool.query("ROLLBACK");
    console.error("Error storing data", err);
    resp.status(500).json({ message: "Error storing data", error: err.message });
  }
};


const get_member_personal = async (req, res) => {
  try {
    const { member_id } = req.params; // Extract the member_id from the request

    // Query for full visitor data
    const query = `
            SELECT *
            FROM sell.member_personal
            WHERE member_id = $1
        `;
    const result = await ambarsariyaPool.query(query, [member_id]);

    if (result.rowCount === 0) {
      // If no rows are found, assume the token is invalid
      res.status(404).json({ valid: false, message: "Invalid member id" });
    } else {
      res.json({ valid: true, data: result.rows });
    }
  } catch (err) {
    console.error("Error processing request:", err);
    res
      .status(500)
      .json({ message: "Error processing request.", error: err.message });
  }
};


const get_member_professional = async (req, res) => {
  try {
    const { member_id, user_id } = req.params; // Extract the member_id from the request

    // Query for full visitor data
    const query = `
            select u.*, uc.username, mp.address, mp.latitude, mp.longitude, mpr.* 
            from sell.users u
            join sell.member_profiles mp 
            on mp.user_id = u.user_id
            join sell.user_credentials uc 
            on uc.user_id = u.user_id
            left join sell.member_professional mpr
            on mpr.member_id = mp.member_id and mpr.user_id = u.user_id 
            WHERE mp.member_id = $1 and u.user_id = $2
        `;
    const result = await ambarsariyaPool.query(query, [member_id, user_id]);

    if (result.rowCount === 0) {
      // If no rows are found, assume the token is invalid
      res.status(404).json({ valid: false, message: "Invalid member or user id" });
    } else {
      res.json({ valid: true, data: result.rows });
    }
  } catch (err) {
    console.error("Error processing request:", err);
    res
      .status(500)
      .json({ message: "Error processing request.", error: err.message });
  }
};

const post_member_professional = async (req, res) => {
  const { member_id, user_id } = req.params;
  const {
    linkedin,
    portfolio,
    title,
    summary,
    skills,
    work_experience_in_years,
    education,
    certification_and_licenses,
    personal_attributes,
    achievements_and_awards,
    professional_affiliations,
    publications_and_presentations,
    projects_and_portfolios,
    reference,
    language,
    volunteer_experience,
    professional_goals
  } = req.body.data;

  try {
    await ambarsariyaPool.query("BEGIN");

    const upsertQuery = `
      INSERT INTO sell.member_professional (
        member_id,
        user_id, 
        linkedin,
        portfolio,
        title,
        summary,
        skills,
        work_experience_in_years,
        education,
        certification_and_licenses,
        personal_attributes,
        achievements_and_awards,
        professional_affiliations,
        publications_and_presentations,
        projects_and_portfolios,
        reference,
        languages,
        volunteer_experience,
        professional_goals
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17, $18, $19
      )
      ON CONFLICT (member_id)
      DO UPDATE SET
      linkedin = EXCLUDED.linkedin,
      portfolio = EXCLUDED.portfolio,
      title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      skills = EXCLUDED.skills,
      work_experience_in_years = EXCLUDED.work_experience_in_years,
      education = EXCLUDED.education,
      certification_and_licenses = EXCLUDED.certification_and_licenses,
      personal_attributes = EXCLUDED.personal_attributes,
      achievements_and_awards = EXCLUDED.achievements_and_awards,
      professional_affiliations = EXCLUDED.professional_affiliations,
      publications_and_presentations = EXCLUDED.publications_and_presentations,
      projects_and_portfolios = EXCLUDED.projects_and_portfolios,
      reference = EXCLUDED.reference,
      languages = EXCLUDED.languages,
      volunteer_experience = EXCLUDED.volunteer_experience,
      professional_goals = EXCLUDED.professional_goals;
    `;

    const values = [
      member_id,
      user_id,
      linkedin,
      portfolio,
      title,
      summary,
      skills,
      work_experience_in_years,
      education,
      certification_and_licenses,
      personal_attributes,
      achievements_and_awards,
      professional_affiliations,
      publications_and_presentations,
      projects_and_portfolios,
      reference,
      language,
      volunteer_experience,
      professional_goals
    ];

    await ambarsariyaPool.query(upsertQuery, values);

    await ambarsariyaPool.query("COMMIT");

    res.status(200).json({ message: "Data saved successfully." });
  } catch (error) {
    await ambarsariyaPool.query("ROLLBACK");
    console.error("Error saving professional data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const post_member_relations = async (req, res) => {
  const { member_id, user_id } = req.params;
  const {
    relation,
    other_relation,
    place_name,
    address,
    latitude,
    longitude,
    work_yrs,
    ongoing_or_left,
    people,
    name_group,
    mentor,
    member_phone_no,
    people_list,
    community,
    last_topic,
    last_event,
    total_score,
    position_score,
    arrange_event,
    next_event,
    passed_event
  } = req.body.data;

  try {
    await ambarsariyaPool.query("BEGIN");

    const upsertQuery = `
      INSERT INTO sell.member_relations (
        member_id,
        user_id, 
        relation,
        other_relation,
        place_name,
        address,
        latitude,
        longitude,
        work_yrs,
        ongoing_or_left,
        people,
        name_group,
        mentor,
        member_phone_no,
        people_list,
        community,
        last_topic,
        last_event,
        total_score,
        position_score,
        arrange_event,
        next_event,
        passed_event
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
      )
    `;

    const values = [
      member_id,
      user_id, 
      relation,
      other_relation,
      place_name,
      address,
      latitude,
      longitude,
      work_yrs,
      ongoing_or_left,
      people,
      name_group,
      mentor,
      member_phone_no,
      people_list,
      community,
      last_topic,
      last_event,
      total_score,
      position_score,
      arrange_event,
      next_event,
      passed_event
    ];

    await ambarsariyaPool.query(upsertQuery, values);

    await ambarsariyaPool.query("COMMIT");

    res.status(200).json({ message: "Relation saved successfully." });
  } catch (error) {
    await ambarsariyaPool.query("ROLLBACK");
    console.error("Error saving relations data:", error);
    res.status(500).json({ error: "Internal server error", message:error.error});
  }
};


const post_member_community = async (req, res) => {
  const {
    member_id, 
    user_id,
    member_relation_id,
    community,
    journal,
    relation,
    group_name,
    media
  } = req.body;

  console.log("Received file:", req.file);


  try {
    await ambarsariyaPool.query("BEGIN");

    let uploadedUSPLink ;

    if (req.file) {
      const targetFolder = "member/community_file";

      // Upload the new file
      uploadedUSPLink = await uploadFileToGCS(req.file, targetFolder);
    }

    const upsertQuery = `
      INSERT INTO sell.member_community (
        member_id, 
        user_id,
        member_relation_id,
        community,
        journal,
        relation,
        group_name,
        media,
        uploaded_file
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9
      )
    `;

    const values = [
      member_id,
      user_id, 
      member_relation_id,
      community,
      journal,
      relation,
      group_name,
      media,
      uploadedUSPLink
    ];

    await ambarsariyaPool.query(upsertQuery, values);

    await ambarsariyaPool.query("COMMIT");

    res.status(200).json({ message: "Community saved successfully." });
  } catch (error) {
    await ambarsariyaPool.query("ROLLBACK");
    console.error("Error saving community data:", error);
    res.status(500).json({ error: "Internal server error", message:error.error});
  }
};


const post_member_events = async (req, res) => {
  const { member_id } = req.params;
  const {
    event_type,
    event_purpose_id,
    event_engagement_id,
    event_name,
    mentor_name,
    relations,
    groups,
    location,
    latitude,
    longitude,
    date,
    time,
    rules_or_description
  } = req.body;

  console.log("Received file:", req.file);

  try {
    await ambarsariyaPool.query("BEGIN");

    // First, insert without uploaded_file_link
    const insertQuery = `
      INSERT INTO sell.member_events (
        member_id,
        event_type,
        event_purpose_id,
        event_engagement_id,
        event_name,
        mentor_name,
        relations,
        groups,
        location,
        latitude,
        longitude,
        date,
        time,
        rules_or_description
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14
      )
      RETURNING id
    `;

    const insertValues = [
      member_id,
      event_type,
      event_purpose_id,
      event_engagement_id,
      event_name,
      mentor_name,
      relations,
      groups,
      location,
      latitude,
      longitude,
      date,
      time,
      rules_or_description
    ];

    const result = await ambarsariyaPool.query(insertQuery, insertValues);
    const eventId = result.rows[0].id;

    await ambarsariyaPool.query("COMMIT");

    // Upload file only after successful DB insert
    if (req.file) {
      const targetFolder = "member/events";

      try {
        const uploadedFileLink = await uploadFileToGCS(req.file, targetFolder);

        // Update the event with the uploaded file link
        await ambarsariyaPool.query(
          `UPDATE sell.member_events SET uploaded_file_link = $1 WHERE id = $2`,
          [uploadedFileLink, eventId]
        );
      } catch (uploadErr) {
        console.error("File upload failed:", uploadErr);
        // Optional: decide whether to delete DB entry or just skip file update
      }
    }

    res.status(200).json({ message: "Event created successfully." });
  } catch (error) {
    await ambarsariyaPool.query("ROLLBACK");
    console.error("Error creating event:", error);
    res.status(500).json({ error: "Internal server error", message:error.detail });
  }
};

const get_member_events = async (req, res) => {
  try {
    const { member_id } = req.params; // Extract the member_id from the request

    // Query for full visitor data
    const query = `
            SELECT me.*, ep.purpose, ee.engagement FROM sell.member_events me
join event_purpose ep 
on ep.id = me.event_purpose_id
join event_engagement ee 
on ee.id = me.event_engagement_id
            WHERE member_id = $1 
        `;
    const result = await ambarsariyaPool.query(query, [member_id]);

    if (result.rowCount === 0) {
      // If no rows are found, assume the token is invalid
      res.status(404).json({ valid: false, message: "No Event exists" });
    } else {
      res.json({ valid: true, data: result.rows });
    }
  } catch (err) {
    console.error("Error processing request:", err);
    res
      .status(500)
      .json({ message: "Error processing request.", error: err.message });
  }
};


const get_member_relations = async (req, res) => {
  try {
    const { member_id, user_id } = req.params;
    const { relation } = req.query;

    let query;
    let params;

    if (relation) {
      query = `
        SELECT * FROM sell.member_relations 
        WHERE member_id = $1 AND user_id = $2 AND relation = $3
      `;
      params = [member_id, user_id, relation];
    } else {
      query = `
        SELECT * FROM sell.member_relations 
        WHERE member_id = $1 AND user_id = $2
      `;
      params = [member_id, user_id];
    }

    const result = await ambarsariyaPool.query(query, params);

    if (result.rowCount === 0) {
      res.status(404).json({ valid: false, message: "No relation found" });
    } else {
      res.json({ valid: true, data: result.rows });
    }
  } catch (err) {
    console.error("Error processing request:", err);
    res.status(500).json({ message: "Error processing request.", error: err.message });
  }
};


const get_member_relation_detail = async (req, res) => {
  try {
    const { member_id, access_token } = req.params; // Extract the member_id from the request

    // Query for full visitor data
    const query = `
            SELECT * FROM sell.member_relations 
            WHERE member_id = $1 AND access_token = $2 
        `;
    const result = await ambarsariyaPool.query(query, [member_id, access_token]);

    if (result.rowCount === 0) {
      // If no rows are found, assume the token is invalid
      res.status(404).json({ valid: false, message: "No Relation exists" });
    } else {
      res.json({ valid: true, data: result.rows });
    }
  } catch (err) {
    console.error("Error processing request:", err);
    res
      .status(500)
      .json({ message: "Error processing request.", error: err.message });
  }
};


const get_member_relation_types = async (req, res) => {
  try {
    const { member_id } = req.params; // Extract the member_id from the request

    // Query for full visitor data
    const query = `
            SELECT distinct
            CASE 
                WHEN relation = 'Other' THEN other_relation 
                ELSE relation 
            END AS relation_name
            FROM sell.member_relations where member_id = $1; 
        `;
    const result = await ambarsariyaPool.query(query, [member_id]);

    if (result.rowCount === 0) {
      // If no rows are found, assume the token is invalid
      res.status(404).json({ valid: false, message: "No Relation exists" });
    } else {
      res.json({ valid: true, data: result.rows });
    }
  } catch (err) {
    console.error("Error processing request:", err);
    res
      .status(500)
      .json({ message: "Error processing request.", error: err.message });
  }
};

const get_member_relation_specific_groups = async (req, res) => {
  try {
    const { member_id, selectedRelation } = req.params; // Extract the member_id from the request

    // Query for full visitor data
    const query = `
            SELECT name_group, id
            FROM sell.member_relations
            WHERE member_id = $1 AND (
                (relation = $2 AND relation != 'Other')
                OR (relation = 'Other' AND other_relation = $2));
        `;
    const result = await ambarsariyaPool.query(query, [member_id, selectedRelation]);

    if (result.rowCount === 0) {
      // If no rows are found, assume the token is invalid
      res.status(404).json({ valid: false, message: "No group exists" });
    } else {
      res.json({ valid: true, data: result.rows });
    }
  } catch (err) {
    console.error("Error processing request:", err);
    res
      .status(500)
      .json({ message: "Error processing request.", error: err.message });
  }
};

const delete_memberRelation = async (req, res) => {
  const { access_token, id } = req.params;

  try {
    await ambarsariyaPool.query("DELETE FROM sell.member_relations WHERE id = $1 AND access_token = $2", [id, access_token]);
    res.json({ message: "Relation deleted successfully" });
  } catch (err) {
    console.error("Error deleting relation:", err);
    res.status(500).json({ error: "Failed to delete relation" });
  }
}

const put_member_share_level = async (req, res) => {
  const {memberId, level, isPublic} = req.body;

  if (!memberId || !level || typeof isPublic !== 'boolean') {
    return res.status(400).json({ success: false, message: 'Invalid parameters' });
  }

  // Dynamically choose the table to update based on the share level
  const table = level.toLowerCase();  // Convert the level to lowercase to match table names (emotional, personal, etc.)
  
  // Ensure the level corresponds to a valid table
  const validLevels = ['emotional', 'personal', 'professional', 'relations', 'locations', 'community'];
  if (!validLevels.includes(table)) {
    return res.status(400).json({ success: false, message: 'Invalid share level' });
  }

  try {
    // Update the public flag in the corresponding share-level table
    const query = `UPDATE sell.member_${table} SET public = $1 WHERE member_id = $2`;
    const result = await ambarsariyaPool.query(query, [isPublic, memberId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Data not found' });
    }

    res.json({ success: true, message: `${level} Share level updated successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'An error occurred' });
  }
} 

const get_member_share_level = async (req, res) => {
  try {
    const { member_id } = req.params; // Extract the member_id from the request

    // Query for full visitor data
    const query = `
            SELECT DISTINCT ON (mp.member_id)
              e.public as "emotional_public",
              p.public as "personal_public",
              prof.public as "professional_public",
              r.public as "relations_public"
            FROM sell.member_profiles mp 
            LEFT JOIN sell.member_emotional e 
            ON e.member_id = mp.member_id
            LEFT JOIN sell.member_personal p 
            ON p.member_id = mp.member_id
            LEFT JOIN sell.member_professional prof 
            ON prof.member_id = mp.member_id
            LEFT JOIN sell.member_relations r 
            ON r.member_id = mp.member_id
            WHERE mp.member_id = $1
        `;
    const result = await ambarsariyaPool.query(query, [member_id]);

    if (result.rowCount === 0) {
      // If no rows are found, assume the token is invalid
      res.status(404).json({ valid: false, message: "Invalid member id" });
    } else {
      res.json({ valid: true, data: result.rows });
    }
  } catch (err) {
    console.error("Error processing request:", err);
    res
      .status(500)
      .json({ message: "Error processing request.", error: err.message });
  }
};

const get_member_event_purpose = async (req, res) => {
  try {
    const { event_type } = req.params; // Extract the member_id from the request

    // Query for full visitor data
    const query = `
            SELECT * FROM event_purpose where event_type = $1
        `;
    const result = await ambarsariyaPool.query(query, [event_type]);

    if (result.rowCount === 0) {
      // If no rows are found, assume the token is invalid
      res.status(404).json({ valid: false, message: "Invalid event type" });
    } else {
      res.json({ valid: true, data: result.rows });
    }
  } catch (err) {
    console.error("Error processing request:", err);
    res
      .status(500)
      .json({ message: "Error processing request.", error: err.message });
  }
};

const get_member_event_purpose_engagement = async (req, res) => {
  try {
    const { event_type, event_purpose_id } = req.params; // Extract the member_id from the request

    // Query for full visitor data
    const query = `
            SELECT 
              epe.id, 
              ep.id AS event_purpose_id, 
              ep.purpose, 
              ee.id AS event_engagement_id, 
              ee.engagement, 
              ep.event_type
            FROM event_purpose_engagement epe
            JOIN event_purpose ep
            ON ep.id = epe.event_purpose_id
            JOIN event_engagement ee
            ON ee.id = epe.engagement_id
            WHERE ep.event_type = $1 and ep.id=$2
        `;
    const result = await ambarsariyaPool.query(query, [event_type, event_purpose_id]);

    if (result.rowCount === 0) {
      // If no rows are found, assume the token is invalid
      res.status(404).json({ valid: false, message: "Invalid event type or purpose" });
    } else {
      res.json({ valid: true, data: result.rows });
    }
  } catch (err) {
    console.error("Error processing request:", err);
    res
      .status(500)
      .json({ message: "Error processing request.", error: err.message });
  }
};

const put_near_by_shops = async (req, res) => {
  const { shop_no, famous_area } = req.body;

  try {
    // 1. Fetch area ID and current near_by_shops
    const fetchQuery = `
      SELECT id, near_by_shops
      FROM admin.famous_areas
      WHERE area_title = $1
    `;
    const result = await ambarsariyaPool.query(fetchQuery, [famous_area]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Famous area not found' });
    }

    const { id, near_by_shops } = result.rows[0];

    // 2. Check if shop_no is already in the array
    const existing = (near_by_shops || []).map(item => item);
    if (existing.includes(shop_no)) {
      return res.status(400).json({ success: false, message: 'shop already exists' });
    }

    // 3. Append shop_no to the JSONB array using PostgreSQL operators
    const updateQuery = `
      UPDATE admin.famous_areas
      SET near_by_shops = 
        CASE
          WHEN near_by_shops IS NULL THEN to_jsonb(ARRAY[$1])
          ELSE near_by_shops || to_jsonb($1)
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;

    await ambarsariyaPool.query(updateQuery, [shop_no, id]);

    res.json({ success: true, message: 'shop_no added successfully' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const get_existing_domains = async (req, res) => {
  try {
    // Query for full visitor data
    const query = `
            SELECT DISTINCT d.* 
            FROM domains d
            JOIN sell.eshop_form ef 
            ON d.domain_id = ef.domain;
        `;
    const result = await ambarsariyaPool.query(query);

    if (result.rowCount === 0) {
      // If no rows are found, assume the token is invalid
      res.status(404).json({ valid: false, message: "No domain exists" });
    } else {
      res.json({ valid: true, data: result.rows });
    }
  } catch (err) {
    console.error("Error processing request:", err);
    res
      .status(500)
      .json({ message: "Error processing request.", error: err.message });
  }
};


const get_existing_sectors = async (req, res) => {
  try {
    const { domain_id } = req.query; // Extract the member_id from the request


    // Query for full visitor data
    const query = `
           SELECT DISTINCT s.* 
            FROM sectors s
            JOIN sell.eshop_form ef 
            ON ef.domain = $1
            AND ef.sector = s.sector_id
        `;
    const result = await ambarsariyaPool.query(query, [domain_id]);

    if (result.rowCount === 0) {
      // If no rows are found, assume the token is invalid
      res.status(404).json({ valid: false, message: "No domain exists" });
    } else {
      res.json({ valid: true, data: result.rows });
    }
  } catch (err) {
    console.error("Error processing request:", err);
    res
      .status(500)
      .json({ message: "Error processing request.", error: err.message });
  }
};

const get_searched_products = async (req, res) => {
  try {
    const { domain_id, sector_id, product } = req.query;

    if (!domain_id) {
      return res.status(400).json({ valid: false, message: "Domain ID is required" });
    }

    let query = `
      SELECT c.category_name, e.business_name, e.shop_access_token, p.*
      FROM sell.products p
      JOIN sell.eshop_form e ON p.shop_no = e.shop_no
      JOIN categories c ON c.category_id = p.category
      WHERE e.domain = $1
    `;
    
    const params = [domain_id];
    let idx = 2;

    if (sector_id) {
      query += ` AND e.sector = $${idx}`;
      params.push(sector_id);
      idx++;
    }

    if (product) {
      query += ` AND (
        LOWER(p.product_name) ILIKE '%' || LOWER($${idx}) || '%' OR
        LOWER(p.product_type) ILIKE '%' || LOWER($${idx}) || '%' OR
        LOWER(p.category::text) ILIKE '%' || LOWER($${idx}) || '%' OR
        LOWER(p.brand) ILIKE '%' || LOWER($${idx}) || '%'
      )`;
      params.push(product);
    }

    const result = await ambarsariyaPool.query(query, params);

    if (result.rowCount === 0) {
      res.status(404).json({ valid: false, message: "No product exists" });
    } else {
      res.json({ valid: true, data: result.rows });
    }

  } catch (err) {
    console.error("Error processing request:", err);
    res.status(500).json({ message: "Error processing request.", error: err.message });
  }
};

const get_shop_categories = async (req, res) => {
  try {
    const { shop_no } = req.query; // Extract the member_id from the request


    // Query for full visitor data
    const query = `
          select c.category_id, c.category_name from sell.eshop_form ef
          join categories c on c.category_id = ANY(ef.category)
          where ef.shop_no = $1
        `;
    const result = await ambarsariyaPool.query(query, [shop_no]);

    if (result.rowCount === 0) {
      // If no rows are found, assume the token is invalid
      res.status(404).json({ valid: false, message: "No category exists" });
    } else {
      res.json({ valid: true, data: result.rows });
    }
  } catch (err) {
    console.error("Error processing request:", err);
    res
      .status(500)
      .json({ message: "Error processing request.", error: err.message });
  }
};

const get_shop_products = async (req, res) => {
  try {
    const { shop_no, category } = req.query; // Extract the member_id from the request


    // Query for full visitor data
    const query = `
          select product_id, product_name, brand from sell.products where category = $2 and shop_no = $1;
        `;
    const result = await ambarsariyaPool.query(query, [shop_no, category]);

    if (result.rowCount === 0) {
      // If no rows are found, assume the token is invalid
      res.status(404).json({ valid: false, message: "No product exists" });
    } else {
      res.json({ valid: true, data: result.rows });
    }
  } catch (err) {
    console.error("Error processing request:", err);
    res
      .status(500)
      .json({ message: "Error processing request.", error: err.message });
  }
};


const get_shop_product_items = async (req, res) => {
  try {
    const { product_id } = req.query; // Extract the member_id from the request


    // Query for full visitor data
    const query = `
          select item_id, selling_price, quantity_in_stock, updated_at, created_at from sell.items where product_id = $1;
        `;
    const result = await ambarsariyaPool.query(query, [product_id]);

    if (result.rowCount === 0) {
      // If no rows are found, assume the token is invalid
      res.status(404).json({ valid: false, message: "No items exists" });
    } else {
      res.json({ valid: true, data: result.rows });
    }
  } catch (err) {
    console.error("Error processing request:", err);
    res
      .status(500)
      .json({ message: "Error processing request.", error: err.message });
  }
};


module.exports = {
  get_checkIfMemberExists,
  get_checkIfShopExists,
  post_book_eshop,
  update_eshop,
  update_eshop_location,
  get_shopUserData,
  get_otherShops,
  post_authLogin,
  post_member_data,
  get_memberData,
  get_userData,
  get_allShops,
  post_visitorData,
  get_visitorData,
  put_visitorData,
  patch_supportChatResponse,
  post_supportChatMessage,
  get_supportChatNotifications,
  get_supportChatMessages,
  delete_supportChatNotifications,
  put_forgetPassword,
  post_verify_otp,
  post_discount_coupons,
  get_discountCoupons,
  get_allUsers,
  get_nearby_shops,
  post_member_emotional,
  get_member_emotional,
  post_member_personal,
  get_member_personal, 
  post_member_professional,
  get_member_professional, 
  post_member_relations,
  get_member_relations,
  get_member_relation_detail,
  delete_memberRelation,
  put_member_share_level,
  get_member_share_level,
  get_member_event_purpose, 
  get_member_event_purpose_engagement,
  post_member_events,
  get_member_events,
  get_member_relation_types,
  get_member_relation_specific_groups,
  post_member_community,
  update_shop_is_open_status,
  put_near_by_shops,
  get_nearby_areas_for_shop,
  get_existing_sectors,
  get_existing_domains,
  get_searched_products,
  get_shop_categories,
  get_shop_products,
  get_shop_product_items
};
