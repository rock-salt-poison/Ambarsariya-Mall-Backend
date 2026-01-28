// Script to create banner_notifications table
// Run this with: node backend/scripts/create_banner_table.js

const { createDbPool } = require("../db_config/db");
const fs = require("fs");
const path = require("path");

const ambarsariyaPool = createDbPool();

async function createBannerTable() {
  try {
    console.log("Creating banner_notifications table...");

    // Read the SQL file
    const sqlPath = path.join(__dirname, "../database/banner_notifications_table.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Execute the SQL
    await ambarsariyaPool.query(sql);

    console.log("banner_notifications table created successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error creating table:", error);
    process.exit(1);
  }
}

createBannerTable();
