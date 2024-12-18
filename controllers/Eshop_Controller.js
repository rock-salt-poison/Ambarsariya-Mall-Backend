const { createDbPool } = require('../db_config/db');
const ambarsariyaPool = createDbPool();
const bcrypt = require('bcrypt');

const post_book_eshop = async (req, resp) => {
    const {
        title,
        fullName,
        username,
        password,
        address,
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
        delivery,user_type
    } = req.body;

    // Validate that required fields are provided
    if (!fullName || !username || !password) {
        return resp.status(400).json({ message: 'Full name, username, and password are required.' });
    }

    // Create `type_of_service` array based on user selection
    const typeOfService = [];
    if (pickup) typeOfService.push(1);
    if (homeVisit) typeOfService.push(2);
    if (delivery) typeOfService.push(3);

    try {
        // Start a transaction
        await ambarsariyaPool.query('BEGIN');

        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert into users table
        const userResult = await ambarsariyaPool.query(
            `INSERT INTO Sell.users 
            (full_name, title, phone_no_1, phone_no_2, user_type, pan_no, cin_no)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING user_id`,
            [fullName, title, phone1, phone2,user_type, pan_no, cin_no]
        );
        const newUserId = userResult.rows[0].user_id;

        // Insert into eshop_form table
        const eshopResult = await ambarsariyaPool.query(
            `INSERT INTO Sell.eshop_form
            (user_id, poc_name, address, domain, created_domain, sector,created_sector, ontime, offtime, type_of_service, gst,msme, paid_version, is_merchant,member_username_or_phone_no, premium_service)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,$13, $14, $15, $16)
            RETURNING shop_no, shop_access_token`,
            [
                newUserId,
                fullName,
                address,
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
                premiumVersion
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
        await ambarsariyaPool.query('COMMIT');
        resp.status(201).json({ message: 'E-shop data successfully created.', shop_access_token: shop_access_token, 
        user_access_token
         });

    } catch (err) {
        // Rollback the transaction in case of error
        await ambarsariyaPool.query('ROLLBACK');
        console.error('Error storing data', err);
        resp.status(500).json({ message: 'Error storing data', error: err.message });
    }
}


const post_member_data = async (req, resp) => {
    const {
        name,
        username,
        password,
        address,
        phone,
        gender,
        age
    } = req.body;

    // Validate that required fields are provided
    if (!name || !username || !password) {
        return resp.status(400).json({ message: 'Full name, username, and password are required.' });
    }

    // Determine title based on gender
    let title = '';
    if (gender === 'Male') {
        title = 'Mr.';
    } else if (gender === 'Female') {
        title = 'Ms.';
    } else {
        title = 'Other'; // or set a default title if needed
    }

    try {
        // Start a transaction
        await ambarsariyaPool.query('BEGIN');

        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert into users table
        const userResult = await ambarsariyaPool.query(
            `INSERT INTO sell.users 
            (full_name, title, phone_no_1, user_type, address, gender, age)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING user_id`,
            [name, title, phone, 'member', address, gender, age]  // Assuming user_type is 'member' here
        );
        const newUserId = userResult.rows[0].user_id;

        // Insert into user_credentials table
        const user_credentials = await ambarsariyaPool.query(
            `INSERT INTO sell.user_credentials 
            (user_id, username, password)
            VALUES ($1, $2, $3)
            RETURNING access_token`,
            [newUserId, username, hashedPassword]
        );

        const user_access_token = user_credentials.rows[0].access_token;

        // Commit the transaction
        await ambarsariyaPool.query('COMMIT');
        resp.status(201).json({
            message: 'Form submitted successfully.',
            user_access_token
        });

    } catch (err) {
        // Rollback the transaction in case of error
        await ambarsariyaPool.query('ROLLBACK');
        console.error('Error storing data', err);
        resp.status(500).json({ message: 'Error storing data', error: err.message });
    }
};


const update_eshop = async (req, resp) => {
    const {
        business_name,
        date_of_establishment,
        usp_values,
        product_samples,
        similar_options,
        cost_sensitivity,
        daily_walkin,
        parking_availability,
        category,
        advt_video,
        key_players,
    } = req.body;

    // Retrieve shopAccessToken from the query parameters
    const  shopAccessToken  = req.params.shopAccessToken;

    if (!shopAccessToken) {
        return resp.status(400).json({ message: 'Shop access token is required.' });
    }

    try {
        // Use an UPDATE statement with parameterized shopAccessToken
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
                usp_values,
                product_samples,
                similar_options,
                key_players,
                cost_sensitivity,
                daily_walkin,
                parking_availability,
                category,
                advt_video,
                shopAccessToken
            ]
        );

        if (eshopResult.rows.length === 0) {
            return resp.status(404).json({ message: 'No e-shop found with the provided access token.' });
        }

        const access_token = eshopResult.rows[0].shop_access_token;

        resp.status(200).json({
            message: 'E-shop data successfully updated.',
            shop_access_token: access_token,
        });

    } catch (err) {
        console.error('Error updating data:', err);
        resp.status(500).json({ message: 'Error updating data', error: err.message });
    }
};

const get_shopUserData = async (req, res) => {
    try {
        const { shop_access_token } = req.query;

        // Validate that the shop_access_token is provided
        if (!shop_access_token) {
            return res.status(400).json({ message: 'Shop access token is required.' });
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
LEFT JOIN public.categories c ON c.category_id = ANY(ef.category)
WHERE ef.shop_access_token = $1
GROUP BY ef.shop_no, ef.user_id, u.user_type, uc.username, u.title, 
         u.full_name, ef.address, u.phone_no_1, u.phone_no_2, d.domain_name, ef.created_domain, 
         s.sector_name, ef.created_sector, ef.ontime, ef.offtime, ef.paid_version, ef.gst, ef.msme, 
         u.pan_no, u.cin_no, ef.is_merchant, ef.member_username_or_phone_no, 
         ef.premium_service, ef.business_name, ef.establishment_date, ef.usp_values_url, 
         ef.product_sample_url, ef.similar_options, ef.key_players, ef.cost_sensitivity, 
         ef.daily_walkin, ef.parking_availability, ef.category, ef.advertisement_video_url, ef.shop_access_token;
`;

        const result = await ambarsariyaPool.query(query, [shop_access_token]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No data found for the provided shop access token.' });
        }

        res.json(result.rows);

    } catch (err) {
        console.error('Error fetching shop user data:', err);
        res.status(500).json({ message: 'Error fetching shop user data.', error: err.message });
    }
};

const get_memberData = async (req,res) => {
    try {
        const { memberAccessToken } = req.query;

        // Validate that the member_access_token is provided
        if (!memberAccessToken) {
            return res.status(400).json({ message: 'Member access token is required.' });
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
                u.age AS "age",
                u.address AS "address"
            FROM Sell.users u
            JOIN Sell.user_credentials uc ON uc.user_id = u.user_id
            WHERE uc.access_token = $1`;

        const result = await ambarsariyaPool.query(query, [memberAccessToken]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No data found for the provided member access token.' });
        }

        res.json(result.rows);

    } catch (err) {
        console.error('Error fetching user data:', err);
        res.status(500).json({ message: 'Error fetching user data.', error: err.message });
    }
}


const get_otherShops = async (req, res) => {
    try{
        const { shopAccessToken } = req.query;
        const result = await ambarsariyaPool.query(`SELECT * FROM Sell.eshop_form 
                WHERE shop_access_token != $1 AND business_name IS NOT NULL`, [shopAccessToken]);
        res.json(result.rows);
    }
    catch(err){
        console.log('Error fetching sectors : ' + err);
        res.status(500).json({message : 'Error fetching sectors.', error: err.message});
    }
}

const get_userData = async (req, res) => {
    try{
        const { userAccessToken } = req.query;
        const result = await ambarsariyaPool.query(`SELECT 
            u.user_type, 
            ef.shop_access_token AS "shop_access_token",
            uc.access_token AS "user_access_token"
        FROM sell.users u
        JOIN sell.user_credentials uc 
            ON u.user_id = uc.user_id
        LEFT JOIN sell.eshop_form ef
            ON u.user_id = ef.user_id
        WHERE uc.access_token = $1;`, [userAccessToken]);
        res.json(result.rows);
    }
    catch(err){
        console.log('Error fetching sectors : ' + err);
        res.status(500).json({message : 'Error fetching sectors.', error: err.message});
    }
}


const post_authLogin = async (req, res) => {
    const { username, password, type } = req.body;
  
    // Input validation
    if (!username || !password || !type) {
      return res.status(400).json({ message: 'Username, password, and type are required.' });
    }
  
    try {
      // Query to find the user credentials by username
      const result = await ambarsariyaPool.query('SELECT * FROM Sell.user_credentials WHERE username = $1', [username]);
  
      // If no user found with the given username
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Username not found.' });
      }
  
      // Iterate through all users with that username
      for (let i = 0; i < result.rows.length; i++) {
        const storedPassword = result.rows[i].password;
        const userAccessToken = result.rows[i].access_token;
        const userId = result.rows[i].user_id; // Get user_id
  
        // Query to get the user type based on user_id
        const userResult = await ambarsariyaPool.query('SELECT user_type FROM Sell.users WHERE user_id = $1', [userId]);
        const userType = userResult.rows[0]?.user_type;
  
        // Validate user type based on provided `type`
        const isValidUserType =
          (type === 'sell' && (userType === 'shop' || userType === 'merchant')) ||
          (type === 'buy' && (userType === 'member' || userType === 'visitor'));
  
        if (!isValidUserType) {
          continue; // Skip this user if the type does not match
        }
  
        // Compare the provided password with the stored password (hashed)
        const isPasswordValid = await bcrypt.compare(password, storedPassword);
  
        if (isPasswordValid) {
          // Return the user access token and user type if password matches and type is valid
          return res.status(200).json({
            message: 'Login successful.',
            user_access_token: userAccessToken,
            user_type: userType,
          });
        }
      }
  
      // If no matching credentials were found
      return res.status(401).json({ message: 'Incorrect password.' });
    } catch (error) {
      console.error('Error logging in:', error);
      res.status(500).json({ message: 'Internal server error.' });
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
        console.error('Error fetching domains', err);
        res.status(500).json({ message: 'Error fetching shops', error: err.message });
    }
}

const post_support_name_password = async (req, resp) => {
    const {
        name,
        phone_no,
        otp
    } = req.body;

    // Validate that required fields are provided
    if (!name || !phone_no) {
        return resp.status(400).json({ message: 'Name and phone no. are required.' });
    }

    try {
        // Start a transaction
        await ambarsariyaPool.query('BEGIN');

        // Insert into users table
        const userResult = await ambarsariyaPool.query(
            `INSERT INTO sell.support 
            (name, phone_no, otp)
            VALUES ($1, $2, $3)
            RETURNING access_token`,
            [name, phone_no, otp]  // Assuming user_type is 'member' here
        );
        const newAccessToken = userResult.rows[0].access_token;

        // Commit the transaction
        await ambarsariyaPool.query('COMMIT');
        resp.status(201).json({
            message: 'Form submitted successfully.',
            newAccessToken
        });

    } catch (err) {
        await ambarsariyaPool.query('ROLLBACK');
        console.error('Error storing data', err);
        resp.status(500).json({ message: 'Error storing data', error: err.message });
    }
}

const get_visitorData = async (req, res) => {
    try {
        const { token } = req.params; // Extract the token from the request

        // Query for full visitor data
        const query = `
            SELECT  
                v.name,
                v.phone_no,
                v.otp,
                v.domain_id,
                d.domain_name,
                v.sector_id,
                s.sector_name,
                v.purpose,
                v.message,
                v.file_attached,
                v.response,
                v.created_at,
                v.updated_at,
                v.access_token
            FROM sell.support v
            LEFT JOIN domains d ON d.domain_id = v.domain_id
            LEFT JOIN sectors s ON s.sector_id = v.sector_id
            WHERE access_token = $1
        `;
        const result = await ambarsariyaPool.query(query, [token]);

        if (result.rowCount === 0) {
            // If no rows are found, assume the token is invalid
            res.status(404).json({ valid: false, message: 'Invalid token' });
        }else{
            res.json({ valid: true, data: result.rows });
        }

    } catch (err) {
        console.error('Error processing request:', err);
        res.status(500).json({ message: 'Error processing request.', error: err.message });
    }
};


const put_visitorData = async (req,resp) => {
        const {
            domain,
            sector,
            purpose,
            message,
            access_token
        } = req.body;

        try{
            const result = await ambarsariyaPool.query(
                `UPDATE Sell.support
                SET domain_id = $1,
                    sector_id = $2,
                    purpose = $3,
                    message = $4
                WHERE access_token = $5
                RETURNING access_token`,
                [
                    domain,
                    sector,
                    purpose,
                    message,
                    access_token
                ]
            );
    
            if (result.rows.length === 0) {
                return resp.status(404).json({ message: 'No visitor found with the provided access token.' });
            }
    
            const visitor_access_token = result.rows[0].access_token;
    
            resp.status(200).json({
                message: 'Visitor data updated successfully.',
                visitor_access_token
            });
        }catch(err){
            console.error('Error updating data:', err);
            resp.status(500).json({ message: 'Error updating data', error: err.message });
        }
}

const put_forgetPassword = async (req, resp) => {
    const { username, password, context } = req.body;

    try {
        // Determine allowed user types based on the context
        let allowedUserTypes = [];
        if (context === "sell") {
            allowedUserTypes = ["shop", "merchant"];
        } else if (context === "buy") {
            allowedUserTypes = ["member", "visitor"];
        } else {
            return resp.status(400).json({ message: "Invalid context provided." });
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
        resp.status(500).json({ message: "Error updating data", error: err.message });
    }
};


module.exports = { post_book_eshop, update_eshop, get_shopUserData, get_otherShops, post_authLogin, post_member_data, get_memberData, get_userData, get_allShops, post_support_name_password, get_visitorData, put_visitorData, put_forgetPassword };
