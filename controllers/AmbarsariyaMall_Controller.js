// /controllers/ambarsariyaController.js
const { createDbPool } = require('../db_config/db');

const ambarsariyaPool = createDbPool();

// Fetch all domains from the AmbarsariyaMall database
const get_domains = async (req, res) => {
  try {
    const result = await ambarsariyaPool.query('SELECT * FROM domains ORDER BY domain_id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching domains', err);
    res.status(500).json({ message: 'Error fetching domains', error: err.message });
  }
};

const get_sectors = async(req, res) => {
    try{
        const result = await ambarsariyaPool.query('SELECT * FROM sectors ORDER BY sector_id');
        res.json(result.rows);
    }
    catch(err){
        console.log('Error fetching sectors : ' + err);
        res.status(500).json({message : 'Error fetching sectors.', error: err.message});
    }
}

const get_category_name = async(req, res) => {
  const {category_id} = req.params;
  try{
      const result = await ambarsariyaPool.query('SELECT * FROM categories WHERE category_id = $1', [category_id]);
      res.json(result.rows);
  }
  catch(err){
      console.log('Error fetching category : ' + err);
      res.status(500).json({message : 'Error fetching category.', error: err.message});
  }
}


const get_category_id = async(req, res) => {
  const {category_name} = req.params;
  try{
      const result = await ambarsariyaPool.query('SELECT category_id FROM categories WHERE category_name = $1', [category_name]);
      res.json(result.rows);
  }
  catch(err){
      console.log('Error fetching category id : ' + err);
      res.status(500).json({message : 'Error fetching category id.', error: err.message});
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
            where ds.domain_id = ${id}
            ORDER BY ds.sector_id`);
        res.json(result.rows);
    }
    catch(err){
        console.log('Error fetching sectors : ' + err);
        res.status(500).json({message : 'Error fetching sectors.', error: err.message});
    }
}


const get_categoriesList = async (req, res) => {
  try{
    const {domain_id, sector_id} = req.query;
    const result = await ambarsariyaPool.query(`
          SELECT d.domain_id, d.domain_name, s.sector_id, s.sector_name, c.category_id, c.category_name
          FROM sector_category sc
          JOIN sectors s ON sc.sector_id = s.sector_id
          JOIN domains d ON sc.domain_id = d.domain_id
          JOIN categories c ON sc.category_id = c.category_id
          WHERE sc.sector_id = $2
          and d.domain_id = $1
          ORDER BY c.category_name
        `, [domain_id, sector_id]);
        res.json(result.rows);
  }catch(e){
    console.log("Error fetching categories : ", e);
    res.status(500).json({message:'Error fetching categories.',
      error : e.message
    });
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

const get_typeOfService = async(req, res) => {
  const {id} = req.params;
  try{
    if(id){
      const result = await ambarsariyaPool.query('SELECT service FROM type_of_services where id = $1', [id]);
      res.json(result.rows);
    }
  }
  catch(err){
      console.log('Error fetching sectors : ' + err);
      res.status(500).json({message : 'Error fetching sectors.', error: err.message});
  }
}

// Export the functions for use in routes
module.exports = { get_domains, get_sectors,get_category_name, get_category_id, get_domainSectors, createDomain, get_typeOfServices, get_typeOfService, get_categoriesList };
