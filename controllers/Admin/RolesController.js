const { createDbPool } = require("../../db_config/db");

const ambarsariyaPool = createDbPool();

const get_departments = async (req, res) => {
  try {
    const result = await ambarsariyaPool.query("SELECT * FROM admin.departments ORDER BY department_name");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching departments:", err);
    res.status(500).json({ error: "Failed to fetch departments" });
  }
};

const get_permissions = async (req, res) => {
  try {
    const result = await ambarsariyaPool.query("SELECT * FROM admin.permissions");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching permissions:", err);
    res.status(500).json({ error: "Failed to fetch permissions" });
  }
};

const get_staff_types = async (req, res) => {
  try {
    const result = await ambarsariyaPool.query("SELECT * FROM admin.staff_types");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching staff types:", err);
    res.status(500).json({ error: "Failed to fetch staff types" });
  }
};


const get_role_employees = async (req, res) => {
  try {
    const result = await ambarsariyaPool.query(`SELECT 
        e.name, 
        e.role_name,
        rp.permission_name,
        e.email, 
        e.username, 
        e.age, 
        e.start_date, 
        e.phone, 
        d.department_name 
    FROM admin.employees e
    LEFT JOIN admin.departments d ON d.id = e.department_id
    LEFT JOIN admin.permissions rp ON rp.id = e.permission_id`);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching staff types:", err);
    res.status(500).json({ error: "Failed to fetch staff types" });
  }
};
module.exports = {
    get_departments,
    get_permissions,
    get_staff_types,
    get_role_employees
};