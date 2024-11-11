// /controllers/ambarsariyaController.js
const { createDbPool } = require('../db_config/db');

const ambarsariyaPool = createDbPool();

// Fetch all domains from the AmbarsariyaMall database
const get_domains = async (req, res) => {
  try {
    const result = await ambarsariyaPool.query('SELECT * FROM domains');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching domains', err);
    res.status(500).json({ message: 'Error fetching domains', error: err.message });
  }
};

const get_sectors = async(req, res) => {
    try{
        const result = await ambarsariyaPool.query('SELECT * FROM sectors');
        res.json(result.rows);
    }
    catch(err){
        console.log('Error fetching sectors : ' + err);
        res.status(500).json({message : 'Error fetching sectors.', error: err.message});
    }
}

const get_domainSectors = async(req, res) => {
    try{
        const id = req.params.id
        const result = await ambarsariyaPool.query(`SELECT 
            ds.domain_id AS domain_id, 
            d.domain_name AS domain_name, 
            ds.sector_id AS sector_id, 
            s.sector_name AS sector_name
            FROM domain_sector ds 
            JOIN domains d ON d.domain_id = ${id}
            JOIN sectors s ON s.sector_id = ds.sector_id
            where ds.domain_id = ${id}`);
        res.json(result.rows);
    }
    catch(err){
        console.log('Error fetching sectors : ' + err);
        res.status(500).json({message : 'Error fetching sectors.', error: err.message});
    }
}

// Example of creating a domain (POST request)
const createDomain = async (req, res) => {
  const { domain_name } = req.body;
  try {
    const result = await ambarsariyaPool.query(
      'INSERT INTO domains (domain_name) VALUES',
      [domain_name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating domain', err);
    res.status(500).json({ message: 'Error creating domain', error: err.message });
  }
};

const get_typeOfServices = async(req, res) => {
  try{
      const result = await ambarsariyaPool.query('SELECT * FROM type_of_services');
      res.json(result.rows);
  }
  catch(err){
      console.log('Error fetching sectors : ' + err);
      res.status(500).json({message : 'Error fetching sectors.', error: err.message});
  }
}

// Export the functions for use in routes
module.exports = { get_domains, get_sectors, get_domainSectors, createDomain, get_typeOfServices };
