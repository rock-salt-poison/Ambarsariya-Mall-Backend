const { createDbPool } = require("../../db_config/db");
const { uploadFileToGCS } = require("../../utils/storageBucket");
const { deleteFileFromGCS } = require("../../utils/deleteFileFromGCS");

const ambarsariyaPool = createDbPool();

const post_travel_time = async (req, res) => {
  const {
    mode,
    travel_type,
    location,
    date,
    time_from,
    time_to,
    from_1,
    time_1,
    to_1,
    departed_time_1,
    arrived_time_1,
    from_2,
    time_2,
    to_2,
    departed_time_2,
    arrived_time_2,
    from_3,
    time_3,
    to_3,
    departed_time_3,
    arrived_time_3,
    from_4,
    time_4,
    to_4,
    departed_time_4,
    arrived_time_4,
    from_5,
    time_5,
    to_5,
    departed_time_5,
    arrived_time_5,
  } = req.body;

  try {
    await ambarsariyaPool.query("BEGIN"); // Start transaction

    // Array of records to process
    const records = [
      {
        travel_from: from_1,
        time: time_1,
        travel_to: to_1,
        record_number: 1,
        departed_at: departed_time_1,
        arrived_at: arrived_time_1,
      },
      {
        travel_from: from_2,
        time: time_2,
        travel_to: to_2,
        record_number: 2,
        departed_at: departed_time_2,
        arrived_at: arrived_time_2,
      },
      {
        travel_from: from_3,
        time: time_3,
        travel_to: to_3,
        record_number: 3,
        departed_at: departed_time_3,
        arrived_at: arrived_time_3,
      },
      {
        travel_from: from_4,
        time: time_4,
        travel_to: to_4,
        record_number: 4,
        departed_at: departed_time_4,
        arrived_at: arrived_time_4,
      },
      {
        travel_from: from_5,
        time: time_5,
        travel_to: to_5,
        record_number: 5,
        departed_at: departed_time_5,
        arrived_at: arrived_time_5,
      },
    ];

    for (const record of records) {
      const {
        travel_from,
        time,
        travel_to,
        record_number,
        departed_at,
        arrived_at,
      } = record;

      // Determine travel_to and travel_from dynamically
      const dynamic_travel_from =
        travel_type === "Departure" ? location : travel_from;
      const dynamic_travel_to =
        travel_type === "Arrival" ? location : travel_to;

      // Check if a record already exists
      const existingRecord = await ambarsariyaPool.query(
        `SELECT id, departed_at, arrived_at FROM admin.travel_time
         WHERE mode = $1 AND travel_type = $2 AND location = $3 AND record_number = $4`,
        [mode, travel_type, location, record_number]
      );

      // Prepare departure_time and arrival_time
      const departure_time = travel_type === "Departure" ? time : null;
      const arrival_time = travel_type === "Arrival" ? time : null;

      // Use existing departed_at and arrived_at values if they already exist
      const final_departed_at =
        departed_at ||
        (existingRecord.rowCount > 0
          ? existingRecord.rows[0].departed_at
          : null);
      const final_arrived_at =
        arrived_at ||
        (existingRecord.rowCount > 0
          ? existingRecord.rows[0].arrived_at
          : null);

      if (existingRecord.rowCount > 0) {
        // Update existing record
        await ambarsariyaPool.query(
          `UPDATE admin.travel_time
           SET time_from = $1, time_to = $2, travel_from = $3, travel_to = $4,
               departure_time = $5, departed_at = $6, arrival_time = $7, arrived_at = $8,
               updated_at = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'::text)
           WHERE id = $9`,
          [
            time_from,
            time_to,
            dynamic_travel_from,
            dynamic_travel_to,
            departure_time,
            final_departed_at,
            arrival_time,
            final_arrived_at,
            existingRecord.rows[0].id,
          ]
        );
      } else {
        // Insert new record
        await ambarsariyaPool.query(
          `INSERT INTO admin.travel_time (
              mode, travel_type, location, date, time_from, time_to, 
              travel_from, travel_to, departure_time, departed_at, 
              arrival_time, arrived_at, record_number
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            mode,
            travel_type,
            location,
            date,
            time_from,
            time_to,
            dynamic_travel_from,
            dynamic_travel_to,
            departure_time,
            final_departed_at,
            arrival_time,
            final_arrived_at,
            record_number,
          ]
        );
      }
    }

    await ambarsariyaPool.query("COMMIT"); // Commit transaction
    res.status(200).json({ message: "Records processed successfully" });
  } catch (error) {
    await ambarsariyaPool.query("ROLLBACK"); // Rollback transaction in case of error
    console.error("Error processing records:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing records" });
  }
};

const post_countries = async (req, res) => {
  const {
    country_name_1,
    country_code_1,
    capital_1,
    time_1,
    currency_1,
    currency_code_1,
    country_name_2,
    country_code_2,
    capital_2,
    time_2,
    currency_2,
    currency_code_2,
    country_name_3,
    country_code_3,
    capital_3,
    time_3,
    currency_3,
    currency_code_3,
    country_name_4,
    country_code_4,
    capital_4,
    time_4,
    currency_4,
    currency_code_4,
    country_name_5,
    country_code_5,
    capital_5,
    time_5,
    currency_5,
    currency_code_5,
    country_name_6,
    country_code_6,
    capital_6,
    time_6,
    currency_6,
    currency_code_6,
  } = req.body;

  try {
    await ambarsariyaPool.query("BEGIN"); // Start transaction

    const records = [
      {
        id: 1,
        country_name: country_name_1,
        country_code: country_code_1,
        capital_time: time_1,
        country_capital: capital_1,
        currency: currency_1,
        currency_code: currency_code_1,
      },
      {
        id: 2,
        country_name: country_name_2,
        country_code: country_code_2,
        capital_time: time_2,
        country_capital: capital_2,
        currency: currency_2,
        currency_code: currency_code_2,
      },
      {
        id: 3,
        country_name: country_name_3,
        country_code: country_code_3,
        capital_time: time_3,
        country_capital: capital_3,
        currency: currency_3,
        currency_code: currency_code_3,
      },
      {
        id: 4,
        country_name: country_name_4,
        country_code: country_code_4,
        capital_time: time_4,
        country_capital: capital_4,
        currency: currency_4,
        currency_code: currency_code_4,
      },
      {
        id: 5,
        country_name: country_name_5,
        country_code: country_code_5,
        capital_time: time_5,
        country_capital: capital_5,
        currency: currency_5,
        currency_code: currency_code_5,
      },
      {
        id: 6,
        country_name: country_name_6,
        country_code: country_code_6,
        capital_time: time_6,
        country_capital: capital_6,
        currency: currency_6,
        currency_code: currency_code_6,
      },
    ];

    for (const record of records) {
      const {
        id,
        country_name,
        country_code,
        country_capital,
        capital_time,
        currency,
        currency_code,
      } = record;

      // Use UPSERT (INSERT ON CONFLICT) for efficiency
      await ambarsariyaPool.query(
        `
        INSERT INTO admin.countries (id, country_name, country_code, country_capital, capital_time, currency, currency_code)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE
        SET 
          country_name = EXCLUDED.country_name,
          country_code = EXCLUDED.country_code,
          country_capital = EXCLUDED.country_capital,
          capital_time = EXCLUDED.capital_time,
          currency = EXCLUDED.currency,
          currency_code = EXCLUDED.currency_code,
          updated_at = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'::text)
        `,
        [
          id,
          country_name,
          country_code,
          country_capital,
          capital_time,
          currency,
          currency_code,
        ]
      );
    }

    await ambarsariyaPool.query("COMMIT");
    res.status(200).json({ message: "Records processed successfully" });
  } catch (error) {
    await ambarsariyaPool.query("ROLLBACK");
    console.error("Error processing records:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing records" });
  }
};

const post_notice = async (req, res) => {
  console.log('Received file:', req.file); // Log the file
  console.log('Request body:', req.body); 
  const { title, to, from_date, to_date, time, location, entry_fee, message, shop_no, from, shop_name, member_name, member_id, community_name } = req.body;

  // const uploadedImgUrl = req.file ? req.file.filename : null;

  let uploadedImgUrl = null;

    if (req.file) {
      // Default to "notice" folder if folderName is not provided
      const targetFolder = "notice";
      uploadedImgUrl = await uploadFileToGCS(req.file, targetFolder);
    }


  if (!title || !from_date || !to_date || !message) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    // Start transaction
    await ambarsariyaPool.query('BEGIN');

    // Insert the notice into the database, including the image URL
    await ambarsariyaPool.query(
      `
        INSERT INTO admin.notice (
          title,
          notice_to, 
          notice_from,
          shop_no,
          shop_name,
          member_id,
          member_name,
          community_name,
          location, 
          from_date, 
          to_date, 
          time, 
          entry_fee, 
          image_src, 
          message
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        title,
        to,
        from,
        shop_no,
        shop_name,
        member_id,
        member_name,
        community_name,
        location,
        from_date,
        to_date,
        time,
        entry_fee,
        uploadedImgUrl, // Use the uploaded file URL
        message,
      ]
    );

    // Commit transaction
    await ambarsariyaPool.query('COMMIT');
    res.status(200).json({ message: 'Notice uploaded successfully', filePath: uploadedImgUrl });
  } catch (error) {
    await ambarsariyaPool.query('ROLLBACK'); // Rollback if there was an error
    console.error('Error saving notice:', error);
    res.status(500).json({ message: 'Failed to upload notice', error });
  }
};

const post_led_board_message = async (req, res) => {
  const { messages } = req.body;
  console.log('Request body:', req.body);

  try {
    // Prepare queries for each message
    const messageQueries = messages.map((message) => {
      // Ensure each message has an id
      if (!message.id) {
        // If no id is provided, insert as a new record
        return ambarsariyaPool.query(
          `INSERT INTO admin.led_board (message)
           VALUES ($1)
           RETURNING id`,
          [message.text]
        );
      } else {
        // If id exists, update the existing record
        return ambarsariyaPool.query(
          `INSERT INTO admin.led_board (id, message)
           VALUES ($1, $2)
           ON CONFLICT (id) DO UPDATE
           SET message = $2, updated_at = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'::text)`,
          [message.id, message.text]
        );
      }
    });

    // Wait for all queries to complete
    await Promise.all(messageQueries);
    res.status(201).json({ message: "Messages saved successfully" });
  } catch (e) {
    console.error("Error saving messages:", e);
    res.status(500).json({ error: "Failed to save messages" });
  }
};

const post_advt = async (req, res) => {
  const { advt, advt_page } = req.body;

  try {
    // Validate shop_no existence before proceeding
    const invalidShopNos = [];

    // Check if each shop_no is valid by querying the sell.eshop_form table
    for (const ad of advt) {
      const { shop } = ad;
      const shopExists = await ambarsariyaPool.query(
        `SELECT shop_access_token FROM sell.eshop_form WHERE shop_no = $1`,
        [shop]
      );

      // If the shop_no does not exist, add it to the invalidShopNos array
      if (shopExists.rowCount === 0) {
        invalidShopNos.push(shop);
      } else {
        // Assign the shop_access_token to the ad object if shop exists
        ad.shop_access_token = shopExists.rows[0].shop_access_token;
      }
    }

    // If there are invalid shop_nos, return an error
    if (invalidShopNos.length > 0) {
      return res.status(400).json({
        error: `Invalid shop_no(s): ${invalidShopNos.join(", ")}`,
      });
    }

    // Prepare queries for each advt, including shop_access_token
    const advtQueries = advt.map((ad) => {
      // Ensure each advt has an id and shop_access_token
      if (!ad.shop) {
        // If no id is provided, insert as a new record with shop_access_token
        return ambarsariyaPool.query(
          `INSERT INTO admin.advt (shop_no, background, advt_page, shop_access_token)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [ad.shop, ad.bg, advt_page, ad.shop_access_token]
        );
      } else {
        // If id exists, update the existing record along with shop_access_token
        return ambarsariyaPool.query(
          `INSERT INTO admin.advt (shop_no, background, advt_page, shop_access_token)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (shop_no, background, advt_page) DO UPDATE
           SET shop_no=$1, background=$2, advt_page = $3, shop_access_token = $4, updated_at = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'::text)`,
          [ad.shop, ad.bg, advt_page, ad.shop_access_token]
        );
      }
    });

    // Wait for all queries to complete
    await Promise.all(advtQueries);
    res.status(201).json({ message: "ADVT saved successfully" });
  } catch (e) {
    console.error("Error saving messages:", e);
    res.status(500).json({ error: "Failed to save advt" });
  }
};

// const post_support_page_famous_areas = async (req, res) => {
//   const { areas } = req.body;
//   console.log("Uploaded Files:", req.files);
//   console.log("Request Body:", areas);

//   try {
//     for (let i = 0; i < areas.length; i++) {
//       const area = areas[i];
//       const lowerCaseTitle = area.area_name.toLowerCase();
//       const lowerCaseAddress = area.area_address.toLowerCase();

//       // Fetch existing image_src from the database
//       const existingImageQuery = await ambarsariyaPool.query(
//         `SELECT image_src FROM admin.famous_areas WHERE area_title = $1`,
//         [lowerCaseTitle]
//       );
//       const existingImageSrc = existingImageQuery.rows[0]?.image_src || null;

//       // Match uploaded files in the order of areas
//       let uploadedBgImg = null;
//       if (req.files[i]) {
//         // ✅ If a new file is uploaded, delete the old one first
//         if (existingImageSrc) {
//           try {
//             await deleteFileFromGCS(existingImageSrc);
//             console.log(`Deleted old image: ${existingImageSrc}`);
//           } catch (error) {
//             console.error("Error deleting old background image:", error);
//           }
//         }

//         // ✅ Upload new image
//         uploadedBgImg = await uploadFileToGCS(req.files[i], "support_page/famous_areas");
//       }

//       // ✅ Insert or update area data in the database
//       await ambarsariyaPool.query(
//         `INSERT INTO admin.famous_areas (
//             area_title,
//             area_address,
//             latitude,
//             longitude,
//             shop_no,
//             length_in_km,
//             image_src
//         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
//         ON CONFLICT (area_title) 
//         DO UPDATE SET 
//             area_address = $2,
//             latitude = $3,
//             longitude = $4,
//             shop_no = $5,
//             length_in_km = $6,
//             image_src = COALESCE($7, admin.famous_areas.image_src), -- Keep old image if new not provided
//             updated_at = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'::text);`,
//         [
//           lowerCaseTitle,
//           lowerCaseAddress,
//           area.latitude,
//           area.longitude,
//           area.shop_no,
//           area.length,
//           uploadedBgImg || existingImageSrc, // Use new image if uploaded, else keep existing one
//         ]
//       );
//     }

//     res.status(201).json({ message: "Area(s) saved successfully" });
//   } catch (e) {
//     console.error("Error saving area(s):", e);
//     res.status(500).json({ error: "Failed to save area(s)" });
//   }
// };

const post_support_page_famous_areas = async (req, res) => {
  const { areas } = req.body;
  console.log("Uploaded Files:", req.files);
  console.log("Request Body:", areas);

  try {
    // ✅ Create a map to match uploaded files with areas by index
    const uploadedFilesMap = {};
    req.files.forEach((file) => {
      const match = file.fieldname.match(/areas\[(\d+)\]\[bg_img\]/);
      if (match) {
        const index = parseInt(match[1], 10);
        uploadedFilesMap[index] = file;
      }
    });

    for (let i = 0; i < areas.length; i++) {
      const area = areas[i];
      const lowerCaseTitle = area.area_name.toLowerCase();
      const lowerCaseAddress = area.area_address.toLowerCase();

      // ✅ Fetch existing image_src from the database for the respective area
      const existingImageQuery = await ambarsariyaPool.query(
        `SELECT image_src FROM admin.famous_areas WHERE area_title = $1`,
        [lowerCaseTitle]
      );
      const existingImageSrc = existingImageQuery.rows[0]?.image_src || null;

      // ✅ Check if a new file is uploaded for the current area based on the index
      let uploadedBgImg = null;
      if (uploadedFilesMap[i]) {
        // ✅ If a new file is uploaded, delete the old image first
        if (existingImageSrc) {
          try {
            await deleteFileFromGCS(existingImageSrc);
            console.log(`Deleted old image for ${lowerCaseTitle}: ${existingImageSrc}`);
          } catch (error) {
            console.error(`Error deleting old image for ${lowerCaseTitle}:`, error);
          }
        }

        // ✅ Upload new image for the respective area
        uploadedBgImg = await uploadFileToGCS(
          uploadedFilesMap[i],
          "support_page/famous_areas"
        );
      }

      // ✅ Insert or update area data in the database
      await ambarsariyaPool.query(
        `INSERT INTO admin.famous_areas (
            area_title,
            area_address,
            latitude,
            longitude,
            length_in_km,
            image_src
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (area_title) 
        DO UPDATE SET 
            area_address = $2,
            latitude = $3,
            longitude = $4,
            length_in_km = $5,
            image_src = COALESCE($6, admin.famous_areas.image_src), -- Keep old image if no new provided
            updated_at = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'::text);`,
        [
          lowerCaseTitle,
          lowerCaseAddress,
          area.latitude,
          area.longitude,
          area.length,
          uploadedBgImg || existingImageSrc, // Use new image if uploaded, else keep existing one
        ]
      );
    }

    res.status(201).json({ message: "Area(s) saved successfully" });
  } catch (e) {
    console.error("Error saving area(s):", e);
    res.status(500).json({ error: "Failed to save area(s)" });
  }
};


const get_notice = async (req, res) => {
  const { title, id } = req.params;

  try {
    await ambarsariyaPool.query("BEGIN"); // Start transaction

    let query, result;

    // Check if 'title' exists and set the query accordingly
    if (title) {
      query = `SELECT * FROM admin.notice WHERE title = $1 AND id = $2`;
      result = await ambarsariyaPool.query(query, [title, id]);
    } else {
      query = `SELECT * FROM admin.notice`;
      result = await ambarsariyaPool.query(query);
    }

    // Handle no results found
    if (result.rowCount === 0) {
      res.status(404).json({ message: "No records found" });
    } else {
      // Return the result rows
      res.json({ data: result.rows, message: "Valid" });
    }

    // Commit the transaction
    await ambarsariyaPool.query("COMMIT");
  } catch (error) {
    // Rollback transaction in case of error
    await ambarsariyaPool.query("ROLLBACK");
    console.error("Error processing records:", error);
    res
      .status(500)
      .json({ message: "An error occurred while processing records", error });
  }
};

const get_travel_time = async (req, res) => {
  const { mode, travel_type } = req.params;
  try {
    const query = `
      SELECT 
        *
      FROM admin.travel_time
      WHERE mode = $1 AND travel_type = $2`;
    const result = await ambarsariyaPool.query(query, [mode, travel_type]);

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Invalid" });
    } else {
      res.json({ data: result.rows, message: "Valid" });
    }
  } catch (err) {
    console.log("Error fetching travel_time : " + err);
    res
      .status(500)
      .json({ message: "Error fetching travel time.", error: err.message });
  }
};

const get_countries = async (req, res) => {
  try {
    const query = `
      SELECT 
        *
      FROM admin.countries ORDER BY id`;
    const result = await ambarsariyaPool.query(query);

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Invalid" });
    } else {
      res.json({ data: result.rows, message: "Valid" });
    }
  } catch (err) {
    console.log("Error fetching travel_time : " + err);
    res
      .status(500)
      .json({ message: "Error fetching travel time.", error: err.message });
  }
};

const get_led_board_message = async (req, res) => {
  try {
    const result = await ambarsariyaPool.query("SELECT * FROM admin.led_board ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};

const get_advt = async (req, res) => {
  const {advt_page} = req.params;

  try {
    await ambarsariyaPool.query("BEGIN"); // Start transaction

    let query, result;

    // Check if 'advt_page' exists and set the query accordingly
    if (advt_page) {
      query = `SELECT * FROM admin.advt WHERE advt_page = $1 ORDER BY id`;
      result = await ambarsariyaPool.query(query, [advt_page]);
    } else {
      query = `SELECT * FROM admin.advt ORDER BY id`;
      result = await ambarsariyaPool.query(query);
    }

    // Handle no results found
    if (result.rowCount === 0) {
      res.status(404).json({ message: "No records found" });
    } else {
      // Return the result rows
      res.json({ data: result.rows, message: "Valid" });
    }

    // Commit the transaction
    await ambarsariyaPool.query("COMMIT");
  } catch (error) {
    // Rollback transaction in case of error
    await ambarsariyaPool.query("ROLLBACK");
    console.error("Error processing records:", error);
    res
      .status(500)
      .json({ message: "An error occurred while processing records", error });
  }
};

const get_support_page_famous_areas = async (req, res) => {
  try {
    const result = await ambarsariyaPool.query("SELECT * FROM admin.famous_areas ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching areas:", err);
    res.status(500).json({ error: "Failed to fetch areas" });
  }
};

const delete_led_board_message = async (req, res) => {
  const { id } = req.params;

  try {
    await ambarsariyaPool.query("DELETE FROM admin.led_board WHERE id = $1", [id]);
    res.json({ message: "Message deleted successfully" });
  } catch (err) {
    console.error("Error deleting message:", err);
    res.status(500).json({ error: "Failed to delete message" });
  }
}

const delete_notice = async (req, res) => {
  const { id, title } = req.params;

  try {
    // 1️⃣ Fetch the image URL before deleting the notice
    const { rows } = await ambarsariyaPool.query(
      "SELECT image_src FROM admin.notice WHERE id = $1 AND title = $2",
      [id, title]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Notice not found" });
    }

    const imageUrl = rows[0].image_src;

    // 2️⃣ Delete the file from GCS
    if (imageUrl) {
      await deleteFileFromGCS(imageUrl);
    }

    // 3️⃣ Delete the notice from the database
    await ambarsariyaPool.query("DELETE FROM admin.notice WHERE id = $1 AND title = $2", [id, title]);

    res.json({ message: "Notice and associated image deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting Notice:", err);
    res.status(500).json({ error: "Failed to delete notice" });
  }
};

const delete_advt = async (req, res) => {
  const { id } = req.params;

  try {
    await ambarsariyaPool.query("DELETE FROM admin.advt WHERE id = $1", [id]);
    res.json({ message: "ADVT deleted successfully" });
  } catch (err) {
    console.error("Error deleting advt:", err);
    res.status(500).json({ error: "Failed to delete advt" });
  }
}

const delete_support_page_famous_area = async (req, res) => {
  const { area_name, area_address, latitude, longitude } = req.body;

  try {
    // 1️⃣ Fetch the image URL before deleting the record
    const selectQuery = `
      SELECT image_src FROM admin.famous_areas 
      WHERE LOWER(area_title) = LOWER($1) 
        AND LOWER(area_address) = LOWER($2) 
        AND latitude = $3 
        AND longitude = $4
    `;

    const selectResult = await ambarsariyaPool.query(selectQuery, [area_name, area_address, latitude, longitude]);

    if (selectResult.rowCount === 0) {
      return res.status(404).json({ message: "No matching area found" });
    }

    const imageUrl = selectResult.rows[0].image_src;

    // 2️⃣ Delete the file from GCS
    if (imageUrl) {
      await deleteFileFromGCS(imageUrl);
    }

    // 3️⃣ Now delete the database record
    const deleteQuery = `
      DELETE FROM admin.famous_areas 
      WHERE LOWER(area_title) = LOWER($1) 
        AND LOWER(area_address) = LOWER($2) 
        AND latitude = $3 
        AND longitude = $4
    `;

    const deleteResult = await ambarsariyaPool.query(deleteQuery, [area_name, area_address, latitude, longitude]);

    res.json({ message: "Area deleted successfully" });
  } catch (err) {
    console.error("Error deleting area:", err);
    res.status(500).json({ error: "Failed to delete area" });
  }
};

const delete_user = async (req, res) => {
  const { user_id } = req.params;

  try {
    // Start a transaction
    await ambarsariyaPool.query('BEGIN');

    // Step 1: Update user_type to 'visitor' in sell.support if access_token matches
    await ambarsariyaPool.query(
      `
      UPDATE sell.support s
      SET user_type = 'visitor'
      FROM sell.user_credentials uc
      WHERE s.access_token = uc.access_token
        AND uc.user_id = $1
      `,
      [user_id]
    );

    // Step 2: Delete the user from sell.users
    await ambarsariyaPool.query(
      `DELETE FROM sell.users WHERE user_id = $1`,
      [user_id]
    );

    // Commit the transaction
    await ambarsariyaPool.query('COMMIT');

    res.json({ message: "User updated and removed successfully" });
  } catch (err) {
    // Rollback in case of error
    await ambarsariyaPool.query('ROLLBACK');
    console.error("Error removing user:", err);
    res.status(500).json({ error: "Failed to update and remove user" });
  }
};



// Export the functions for use in routes
module.exports = {
  post_travel_time,
  get_travel_time,
  post_countries,
  get_countries,
  post_notice,
  get_notice,
  delete_notice,
  post_led_board_message,
  get_led_board_message,
  delete_led_board_message,
  get_advt,
  post_advt,
  delete_advt,
  post_support_page_famous_areas,
  get_support_page_famous_areas,
  delete_support_page_famous_area,
  delete_user
};
