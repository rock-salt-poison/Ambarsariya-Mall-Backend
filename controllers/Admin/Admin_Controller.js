const { createDbPool } = require("../../db_config/db");

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
               updated_at = CURRENT_TIMESTAMP
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
          currency_code = EXCLUDED.currency_code
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

  const uploadedImgUrl = req.file ? req.file.filename : null;

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
           SET message = $2, updated_at = NOW()`,
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
    await ambarsariyaPool.query("DELETE FROM admin.notice WHERE id = $1 AND title = $2", [id, title]);
    res.json({ message: "Notice deleted successfully" });
  } catch (err) {
    console.error("Error deleting Notice:", err);
    res.status(500).json({ error: "Failed to delete notice" });
  }
}

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
};
