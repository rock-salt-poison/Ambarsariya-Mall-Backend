const { createDbPool } = require("../../db_config/db");
const bcrypt = require("bcrypt");

const ambarsariyaPool = createDbPool();


const post_authLogin = async (req, res) => {
  const { email, password } = req.body;

  // Input validation
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  try {
    // Query user by email
    const result = await ambarsariyaPool.query(
      "SELECT * FROM admin.employees WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Email not found." });
    }

    const user = result.rows[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Return token and optional user info
    return res.status(200).json({
      message: "Login successful.",
      user_access_token: user.access_token,
    });
  } catch (error) {
    console.error("Error logging in:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const get_userByToken = async (req, res) => {
  const { token } = req.params; // access token from frontend

  if (!token) return res.status(400).json({ message: "Token is required" });

  try {
    const query = `
      SELECT 
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
      LEFT JOIN admin.permissions rp ON rp.id = e.permission_id
      WHERE e.access_token = $1
    `;

    const result = await ambarsariyaPool.query(query, [token]);

    if (result.rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    return res.status(200).json({ user: result.rows[0] });
  } catch (error) {
    console.error("Error fetching user by token:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


module.exports ={
    post_authLogin, 
    get_userByToken
}