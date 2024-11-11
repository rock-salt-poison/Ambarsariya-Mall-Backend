const { Pool } = require('pg');

// Function to get the database configuration based on the environment
function getDbConfig(dbName) {
  const dbConfig = {
    user: 'Merchant',         
    host: 'localhost',          
    password: 'merchant123', 
    database:'AmbrsariyaMall' ,
    port: 5432,                 
  };

  // Assign database name dynamically
  // switch (dbName) {
  //   case 'AmbarsariyaMall':
  //     dbConfig.database = 'AmbrsariyaMall';
  //     break;
  //   case 'Sell':
  //     dbConfig.database = 'Sell';
  //     break;
  //   case 'Serve':
  //     dbConfig.database = 'Serve';
  //     break;
  //   case 'Socialize':
  //     dbConfig.database = 'Socialize';
  //     break;
  //   default:
  //     dbConfig.database = 'default_database';  // Add a default if needed
  // }

  return dbConfig;
}

// Function to create a pool connection for a specific database
// function createDbPool(dbName) {
//   const dbConfig = getDbConfig(dbName);
//   return new Pool(dbConfig);
// }

function createDbPool() {
  const dbConfig = getDbConfig();
  return new Pool(dbConfig);
}

// Export function to create pool connections for different databases
module.exports = { createDbPool };
