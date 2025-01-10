const { createDbPool } = require('../../db_config/db');

const ambarsariyaPool = createDbPool();

const post_travel_time = async (req, res) => {
  const {
    mode,
    travel_type,
    location,
    date,
    time_from,
    time_to,
    from_1, time_1, to_1, departed_time_1, arrived_time_1,
    from_2, time_2, to_2, departed_time_2, arrived_time_2,
    from_3, time_3, to_3, departed_time_3, arrived_time_3,
    from_4, time_4, to_4, departed_time_4, arrived_time_4,
    from_5, time_5, to_5, departed_time_5, arrived_time_5,
  } = req.body;

  try {
    await ambarsariyaPool.query('BEGIN'); // Start transaction

    // Array of records to process
    const records = [
      { travel_from: from_1, time: time_1, travel_to: to_1, record_number: 1, departed_at: departed_time_1, arrived_at: arrived_time_1 },
      { travel_from: from_2, time: time_2, travel_to: to_2, record_number: 2, departed_at: departed_time_2, arrived_at: arrived_time_2 },
      { travel_from: from_3, time: time_3, travel_to: to_3, record_number: 3, departed_at: departed_time_3, arrived_at: arrived_time_3 },
      { travel_from: from_4, time: time_4, travel_to: to_4, record_number: 4, departed_at: departed_time_4, arrived_at: arrived_time_4 },
      { travel_from: from_5, time: time_5, travel_to: to_5, record_number: 5, departed_at: departed_time_5, arrived_at: arrived_time_5 },
    ];

    for (const record of records) {
      const { travel_from, time, travel_to, record_number, departed_at, arrived_at } = record;

      // Determine travel_to and travel_from dynamically
      const dynamic_travel_from = travel_type === 'Departure' ? location : travel_from;
      const dynamic_travel_to = travel_type === 'Arrival' ? location : travel_to;

      // Check if a record already exists
      const existingRecord = await ambarsariyaPool.query(
        `SELECT id, departed_at, arrived_at FROM admin.travel_time
         WHERE mode = $1 AND travel_type = $2 AND location = $3 AND record_number = $4`,
        [mode, travel_type, location, record_number]
      );

      // Prepare departure_time and arrival_time
      const departure_time = travel_type === 'Departure' ? time : null;
      const arrival_time = travel_type === 'Arrival' ? time : null;

      // Use existing departed_at and arrived_at values if they already exist
      const final_departed_at = departed_at || (existingRecord.rowCount > 0 ? existingRecord.rows[0].departed_at : null);
      const final_arrived_at = arrived_at || (existingRecord.rowCount > 0 ? existingRecord.rows[0].arrived_at : null);

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
            existingRecord.rows[0].id
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
            record_number
          ]
        );
      }
    }

    await ambarsariyaPool.query('COMMIT'); // Commit transaction
    res.status(200).json({ message: 'Records processed successfully' });
  } catch (error) {
    await ambarsariyaPool.query('ROLLBACK'); // Rollback transaction in case of error
    console.error('Error processing records:', error);
    res.status(500).json({ error: 'An error occurred while processing records' });
  }
};



const get_travel_time = async (req, res) => {
  const {mode, travel_type} = req.params;
  try{  
    const query = `
      SELECT 
        *
      FROM admin.travel_time
      WHERE mode = $1 AND travel_type = $2`;
    const result = await ambarsariyaPool.query(query, [mode, travel_type]);

    if(result.rowCount === 0){
      res.status(404).json({message:'Invalid'});
    }else{
      res.json({data: result.rows, message: 'Valid'});
    }

  }catch(err){
    console.log('Error fetching travel_time : ' + err);
    res.status(500).json({ message: 'Error fetching travel time.', error: err.message });
  }
}


// Export the functions for use in routes
module.exports = { post_travel_time, get_travel_time };
