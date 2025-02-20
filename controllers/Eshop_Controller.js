const { createDbPool } = require("../db_config/db");
const ambarsariyaPool = createDbPool();
const bcrypt = require("bcrypt");
const { uploadFileToGCS } = require("../utils/storageBucket");
const { deleteFileFromGCS } = require("../utils/deleteFileFromGCS");

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

  // Validate that required fields are provided
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
    // Start a transaction
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
            (user_id, poc_name, address, latitude, longitude, domain, created_domain, sector,created_sector, ontime, offtime, type_of_service, gst,msme, paid_version, is_merchant,member_username_or_phone_no, premium_service)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,$13, $14, $15, $16, $17, $18)
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

    // Insert into user_credentials table
    const user_credentials = await ambarsariyaPool.query(
      `INSERT INTO Sell.user_credentials 
            (user_id, username, password)
            VALUES ($1, $2, $3)
            RETURNING access_token`,
      [newUserId, username, hashedPassword]
    );

    const user_access_token = user_credentials.rows[0].access_token;

    // Insert into user_shops table
    await ambarsariyaPool.query(
      `INSERT INTO Sell.user_shops
            (user_id, shop_no)
            VALUES ($1, $2)`,
      [newUserId, newShopNo]
    );

    // Commit the transaction
    await ambarsariyaPool.query("COMMIT");
    resp.status(201).json({
      message: "E-shop data successfully created.",
      shop_access_token: shop_access_token,
      user_access_token,
    });
  } catch (err) {
    // Rollback the transaction in case of error
    await ambarsariyaPool.query("ROLLBACK");
    console.error("Error storing data", err);
    resp
      .status(500)
      .json({ message: "Error storing data", error: err.message });
  }
};

// const post_member_data = async (req, resp) => {
//   const { name, username, password, address, phone, gender, dob } = req.body;

//   // Validate that required fields are provided
//   if (!name || !username || !password) {
//     return resp
//       .status(400)
//       .json({ message: "Full name, username, and password are required." });
//   }

//   // Determine title based on gender
//   let title = "";
//   if (gender === "Male") {
//     title = "Mr.";
//   } else if (gender === "Female") {
//     title = "Ms.";
//   } else {
//     title = "Other"; // or set a default title if needed
//   }

//   try {
//     // Start a transaction
//     await ambarsariyaPool.query("BEGIN");

//     const hashedPassword = await bcrypt.hash(password, 10);

//     // Insert into users table
//     const userResult = await ambarsariyaPool.query(
//       `INSERT INTO sell.users 
//             (full_name, title, phone_no_1, user_type, address, gender, dob)
//             VALUES ($1, $2, $3, $4, $5, $6, $7)
//             RETURNING user_id`,
//       [name, title, phone, "member", address, gender, dob] // Assuming user_type is 'member' here
//     );
//     const newUserId = userResult.rows[0].user_id;

//     // Insert into user_credentials table
//     const user_credentials = await ambarsariyaPool.query(
//       `INSERT INTO sell.user_credentials 
//             (user_id, username, password)
//             VALUES ($1, $2, $3)
//             RETURNING access_token`,
//       [newUserId, username, hashedPassword]
//     );

//     const user_access_token = user_credentials.rows[0].access_token;

//     // Commit the transaction
//     await ambarsariyaPool.query("COMMIT");
//     resp.status(201).json({
//       message: "Form submitted successfully.",
//       user_access_token,
//     });
//   } catch (err) {
//     // Rollback the transaction in case of error
//     await ambarsariyaPool.query("ROLLBACK");
//     console.error("Error storing data", err);
//     resp
//       .status(500)
//       .json({ message: "Error storing data", error: err.message });
//   }
// };


// const post_member_data = async (req, resp) => {

//   console.log('Received files:', req.files["profile_img"]); // Log the file

//   const { name, username, password, address,latitude, longitude, phone, gender, dob } = req.body;

//   if (!name || !username || !password) {
//     return resp
//       .status(400)
//       .json({ message: "Full name, username, and password are required." });
//   }

//   let uploadedProfileUrl = null;
//   let uploadedBgImgUrl = null;

//   const profileFile = req.files["profile_img"] ? req.files["profile_img"][0] : null;
//   const bgFile = req.files["bg_img"] ? req.files["bg_img"][0] : null;

//   if (profileFile) {
//     uploadedProfileUrl = await uploadFileToGCS(profileFile, "member_display_picture");
//   }
//   if (bgFile) {
//     uploadedBgImgUrl = await uploadFileToGCS(bgFile, "member_background_picture");
//   }

//   // Determine title based on gender
//   let title = gender === "Male" ? "Mr." : gender === "Female" ? "Ms." : "Other";

//   try {
//     await ambarsariyaPool.query("BEGIN"); // Start transaction

//     const hashedPassword = await bcrypt.hash(password, 10);

//     // Insert into users table
//     const userResult = await ambarsariyaPool.query(
//       `INSERT INTO sell.users 
//             (full_name, title, phone_no_1, user_type, gender)
//             VALUES ($1, $2, $3, $4, $5)
//             RETURNING user_id`,
//       [name, title, phone, "member", gender]
//     );
//     const newUserId = userResult.rows[0].user_id;

//     // Insert into user_credentials table
//     const userCredentials = await ambarsariyaPool.query(
//       `INSERT INTO sell.user_credentials 
//             (user_id, username, password)
//             VALUES ($1, $2, $3)
//             RETURNING access_token`,
//       [newUserId, username, hashedPassword]
//     );

//     const userAccessToken = userCredentials.rows[0].access_token;

//     // Insert into member_profiles table
//     await ambarsariyaPool.query(
//       `INSERT INTO sell.member_profiles 
//             (user_id, address, latitude, longitude, dob, profile_img, bg_img)
//             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
//       [newUserId, address, latitude, longitude, dob, uploadedProfileUrl, uploadedBgImgUrl]
//     );

//     await ambarsariyaPool.query("COMMIT"); // Commit transaction

//     resp.status(201).json({
//       message: "Form submitted successfully.",
//       user_access_token: userAccessToken,
//     });
//   } catch (err) {
//     await ambarsariyaPool.query("ROLLBACK"); // Rollback in case of error
//     console.error("Error storing data", err);
//     resp.status(500).json({ message: "Error storing data", error: err.message });
//   }
// };


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
    similar_options,
    cost_sensitivity,
    daily_walkin,
    parking_availability,
    category,
    advt_video,
    key_players,
  } = req.body;
  console.log('Received file:', req.file); // Log the file

  const shopAccessToken = req.params.shopAccessToken;

  if (!shopAccessToken) {
    return resp.status(400).json({ message: "Shop access token is required." });
  }

  try {
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
           similar_options = $5,
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
        similar_options,
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
    resp.status(500).json({ message: "Error updating data", error: err.message });
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
    ef.latitude AS "latitude",
    ef.longitude AS "longitude",
    ef.shop_access_token AS "shop_access_token"
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
         ef.product_sample_url, ef.similar_options, ef.key_players, ef.cost_sensitivity, 
         ef.daily_walkin, ef.parking_availability, ef.category, ef.advertisement_video_url, ef.latitude, ef.longitude, ef.shop_access_token;
`;

    const result = await ambarsariyaPool.query(query, [shop_access_token]);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No data found for the provided shop access token." });
    }

    res.json(result.rows);
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
                mp.bg_img
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
        ef.shop_no AS "shop_no",
        ef.shop_access_token AS "shop_access_token",
        uc.access_token AS "user_access_token",
        s.support_id,
        s.visitor_id
      FROM sell.users u
      JOIN sell.user_credentials uc 
        ON u.user_id = uc.user_id
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
                    support_id, visitor_id, 
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

// const post_visitorData = async (req, resp) => {
//   const { name, phone_no, otp } = req.body;

//   try {
//     // Start a transaction
//     await ambarsariyaPool.query("BEGIN");


//     let newAccessToken = null;

//       // If user does not exist in users table, create a new access token
//       const insertSupport = await ambarsariyaPool.query(
//         `INSERT INTO sell.support (name, phone_no, otp)
//                 VALUES ($1, $2, $3)
//                 RETURNING access_token`,
//         [name, phone_no, otp]
//       );
//       newAccessToken = insertSupport.rows[0].access_token;

//     // Commit the transaction
//     await ambarsariyaPool.query("COMMIT");

//     return resp.status(201).json({
//       message: "Form submitted successfully.",
//       access_token: newAccessToken,
//     });
//   } catch (err) {
//     await ambarsariyaPool.query("ROLLBACK");
//     console.error("Error storing data:", err);
//     return resp
//       .status(500)
//       .json({ message: "Error storing data", error: err.message });
//   }
// };


const get_visitorData = async (req, res) => {
  try {
    const { token } = req.params; // Extract the token from the request

    // Query for full visitor data
    const query = `
            SELECT  
                v.*,
                d.domain_name,
                s.sector_name
            FROM sell.support v
            LEFT JOIN domains d ON d.domain_id = v.domain_id
            LEFT JOIN sectors s ON s.sector_id = v.sector_id
            WHERE access_token = $1
        `;
    const result = await ambarsariyaPool.query(query, [token]);

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

// const put_visitorData = async (req, resp) => {
//   const { domain, sector, purpose, message, access_token } = req.body;

//   try {
//     const result = await ambarsariyaPool.query(
//       `UPDATE Sell.support
//                 SET domain_id = $1,
//                     sector_id = $2,
//                     purpose = $3,
//                     message = $4,
//                     updated_at = CURRENT_TIMESTAMP
//                 WHERE access_token = $5
//                 RETURNING access_token`,
//       [domain, sector, purpose, message, access_token]
//     );

//     if (result.rows.length === 0) {
//       return resp
//         .status(404)
//         .json({ message: "No visitor found with the provided access token." });
//     }

//     const visitor_access_token = result.rows[0].access_token;

//     resp.status(200).json({
//       message: "Visitor data updated successfully.",
//       visitor_access_token,
//     });
//   } catch (err) {
//     console.error("Error updating data:", err);
//     resp
//       .status(500)
//       .json({ message: "Error updating data", error: err.message });
//   }
// };


const put_visitorData = async (req, resp) => {
  const { name, phone_no, domain, sector, purpose, message, user_type, access_token } = req.body;
  console.log(req.file);

  try {
    let uploadedFile = null;
    const currentfile = req.file ? req.file : null;

    if (currentfile) {
      uploadedFile = await uploadFileToGCS(currentfile, "support_page/file_attached");
    }

    // Check if access_token already exists
    const existingRecord = await ambarsariyaPool.query(
      `SELECT file_attached FROM Sell.support WHERE access_token = $1`,
      [access_token]
    );

    let result;

    if (existingRecord.rows.length > 0) {
      const existingFile = existingRecord.rows[0].file_attached;

      // Delete old file if new file is uploaded
      if (existingFile && uploadedFile) {
        await deleteFileFromGCS(existingFile);
      }

      // Update the existing record
      result = await ambarsariyaPool.query(
        `UPDATE Sell.support
         SET domain_id = $1,
             sector_id = $2,
             purpose = $3,
             message = $4,
             file_attached = $5,
             updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'
         WHERE access_token = $6
         RETURNING access_token`,
        [domain, sector, purpose, message, uploadedFile || existingFile, access_token]
      );
    } else {
      // Insert a new record
      result = await ambarsariyaPool.query(
        `INSERT INTO Sell.support 
         (name, phone_no, domain_id, sector_id, purpose, message, file_attached, user_type, access_token, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 
                 CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata', 
                 CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
         RETURNING access_token`,
        [name, phone_no, domain, sector, purpose, message, uploadedFile,user_type, access_token]
      );
    }

    const visitor_access_token = result.rows[0].access_token;

    resp.status(200).json({
      message: existingRecord.rows.length > 0
        ? "Visitor data updated successfully."
        : "New visitor record created successfully.",
      visitor_access_token,
    });
  } catch (err) {
    console.error("Error processing visitor data:", err);
    resp.status(500).json({
      message: "Error processing visitor data",
      error: err.message,
    });
  }
};



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

      const { discounts } = data;

      for (const [couponType, discountData] of Object.entries(discounts)) {
        if (!discountData.checked) continue;

        // Ensure the date_range is valid, if not set default values
        const validityStart = discountData.date_range?.[0] || "2024-01-01"; // Default to a specific start date if missing
        const validityEnd = discountData.date_range?.[1] || "2024-12-31"; // Default to a specific end date if missing

        // Check if date_range values are still missing and return an error if so
        if (!validityStart || !validityEnd) {
          return res
            .status(400)
            .json({ error: "Validity start and end dates are required" });
        }

        const couponQuery = `
            INSERT INTO sell.discount_coupons (coupon_type, discount_category, shop_no, validity_start, validity_end)
            VALUES ($1, $2, $3, $4, $5)
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
      // Fetch the area details using the token
      const areaResult = await ambarsariyaPool.query(
          `SELECT * FROM admin.famous_areas WHERE access_token = $1`, 
          [token]
      );

      if (areaResult.rows.length === 0) {
          return res.status(404).json({ error: "Area not found" });
      }

      const { latitude, longitude, length_in_km } = areaResult.rows[0];

      // Fetch nearby shops
      const shopResult = await ambarsariyaPool.query(
          `SELECT 
              shop_access_token
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

      res.json({...areaResult.rows[0], shops:  shopResult.rows});
  } catch (err) {
      console.error("Error fetching nearby shops:", err);
      res.status(500).json({ error: "Server error" });
  }
};


module.exports = {
  post_book_eshop,
  update_eshop,
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
  put_forgetPassword,
  post_verify_otp,
  post_discount_coupons,
  get_discountCoupons,
  get_allUsers,
  get_nearby_shops,
};
