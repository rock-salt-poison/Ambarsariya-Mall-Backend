const { Pool } = require('pg');
require('dotenv').config();

// Function to get database configuration
function getDbConfig(dbName = 'AmbrsariyaMall') {
  return {
    user: process.env.DB_USER || 'Merchant',          // Default to 'Merchant' if not set
    host: process.env.DB_HOST || 'localhost',         // Default to 'localhost'
    password: process.env.DB_PASSWORD || 'merchant123', // Default password
    database: process.env.DB_NAME || dbName,          // Default database name
    port: parseInt(process.env.DB_PORT, 10) || 5432,  // Default port 5432
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false, // SSL for production
  };
}

// Function to create a new connection pool
function createDbPool(dbName) {
  const dbConfig = getDbConfig(dbName);
  return new Pool(dbConfig);
}

// Export the function to create a pool
module.exports = { createDbPool };
