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
                uc.password AS "password",
                u.title AS "title",
                u.full_name AS "full_name",
                ef.address AS "address",
                u.phone_no_1 AS "phone_no_1",
                u.phone_no_2 AS "phone_no_2",
                d.domain_name AS "domain_name",
                s.sector_name AS "sector_name",
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
                ef.key_players AS "key_players",
                ef.cost_sensitivity AS "cost_sensitivity",
                ef.daily_walkin AS "daily_walkin",
                ef.parking_availability AS "parking_availability",
                ef.category AS "category",
                ef.advertisement_video_url
            FROM Sell.users u
            JOIN Sell.eshop_form ef ON ef.user_id = u.user_id
            JOIN Sell.user_credentials uc ON uc.user_id = u.user_id
            JOIN Sell.user_shops us ON us.user_id = u.user_id
            JOIN public.domains d ON d.domain_id = ef.domain
            JOIN public.sectors s ON s.sector_id = ef.sector
            LEFT JOIN public.type_of_services st ON st.id = ANY(ef.type_of_service)
            WHERE ef.shop_access_token = $1
            GROUP BY ef.shop_no, ef.user_id, u.user_type, uc.username, uc.password, u.title, 
                     u.full_name, ef.address, u.phone_no_1, u.phone_no_2, d.domain_name, 
                     s.sector_name, ef.ontime, ef.offtime, ef.paid_version, ef.gst, ef.msme, 
                     u.pan_no, u.cin_no, ef.is_merchant, ef.member_username_or_phone_no, 
                     ef.premium_service, ef.business_name, ef.establishment_date, ef.usp_values_url, 
                     ef.product_sample_url, ef.similar_options, ef.key_players, ef.cost_sensitivity, 
                     ef.daily_walkin, ef.parking_availability, ef.category, ef.advertisement_video_url`;

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


const get_allShops = async (req, res) => {
    try{
        const result = await ambarsariyaPool.query('SELECT * FROM Sell.eshop_form');
        res.json(result.rows);
    }
    catch(err){
        console.log('Error fetching sectors : ' + err);
        res.status(500).json({message : 'Error fetching sectors.', error: err.message});
    }
}

module.exports = { post_book_eshop, update_eshop, get_shopUserData, get_allShops };
