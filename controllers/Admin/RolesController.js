const { createDbPool } = require("../../db_config/db");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");


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

const get_staff = async (req, res) => {
  try {
    const token = req.params.token;

    if (!token) {
      return res.status(401).json({ message: "Token required" });
    }

    // 1️⃣ Get logged-in employee
    const employeeResult = await ambarsariyaPool.query(
      `
      SELECT id, department_id
      FROM admin.employees
      WHERE access_token = $1
      `,
      [token]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const employeeId = employeeResult.rows[0].id;

    // 2️⃣ Fetch staff under this employee
    const staffResult = await ambarsariyaPool.query(
      `
      SELECT 
        s.name,
        st.staff_type_name,
        s.email,
        s.username,
        s.age,
        s.start_date,
        s.assign_area,
        s.phone,
        d.department_name
      FROM admin.staff s
      LEFT JOIN admin.staff_types st ON st.id = s.staff_type_id
      LEFT JOIN admin.employees e ON e.id = s.manager_id
      LEFT JOIN admin.departments d ON d.id = e.department_id
      WHERE s.manager_id = $1
      `,
      [employeeId]
    );

    res.json(staffResult.rows);
  } catch (err) {
    console.error("Error fetching staff:", err);
    res.status(500).json({ error: "Failed to fetch staff" });
  }
};


const create_role_employee = async (req, resp) => {
  console.log(req.body);
  const {
    department,
    role_name,
    rights,
    username,
    password,
    name,
    phone,
    email,
    age,
    start_date,
  } = req.body;

  
  try {
    // -------------------------------------
    // 1️⃣ VALIDATION: Check required fields
    // -------------------------------------
    if (!department || !role_name || !rights || !username || !password) {
      return resp
        .status(400)
        .json({ message: "Missing required fields" });
    }

    // -------------------------------------
    // 2️⃣ HASH PASSWORD
    // -------------------------------------
    const hashedPassword = await bcrypt.hash(password, 10);

    // -------------------------------------
    // 3️⃣ INSERT DATA INTO admin.employees TABLE
    // -------------------------------------
    const result = await ambarsariyaPool.query(
      `INSERT INTO admin.employees
        (department_id, role_name, permission_id, username, password, name, phone, email, age, start_date)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        department,
        role_name,
        rights,
        username,
        hashedPassword,
        name,
        phone,
        email,
        age,
        start_date,
      ]
    );

    const employeeId = result.rows[0]?.id;

    if (!employeeId) {
      return resp.status(500).json({
        message: "Error creating employee entry",
      });
    }

    // -------------------------------------
    // 4️⃣ SEND EMAIL WITH PASSWORD
    // -------------------------------------
    if (email) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const mailOptions = {
        from: process.env.SMTP_USER,
        to: email,
        subject: "🎉 Employee Login Credentials | Ambarsariya Mall",
        html: `
          <h2>Hello ${name},</h2>
          <p>Your employee profile has been created successfully.</p>
          <p><strong>Login Details:</strong></p>
          <p><b>Username:</b> ${username}</p>
          <p><b>Password:</b> ${password}</p>
          <br />
          <p>Regards,<br>Ambarsariya Mall Team</p>
        `,
      };

      await transporter.sendMail(mailOptions);
    }

    // -------------------------------------
    // 5️⃣ SUCCESS RESPONSE
    // -------------------------------------
    return resp.status(201).json({
      message: "Role & Employee created successfully",
      employee_id: employeeId,
    });

  } catch (err) {
    console.error("Error creating role employee:", err);
    return resp.status(500).json({
      message: "Internal Server Error",
      error: err.message,
    });
  }
};

const create_staff = async (req, resp) => {
  console.log(req.body);
  const {
    department,
    role_name,
    rights,
    username,
    password,
    name,
    phone,
    email,
    age,
    start_date,
  } = req.body;

  
  try {
    // -------------------------------------
    // 1️⃣ VALIDATION: Check required fields
    // -------------------------------------
    if (!department || !role_name || !rights || !username || !password) {
      return resp
        .status(400)
        .json({ message: "Missing required fields" });
    }

    // -------------------------------------
    // 2️⃣ HASH PASSWORD
    // -------------------------------------
    const hashedPassword = await bcrypt.hash(password, 10);

    // -------------------------------------
    // 3️⃣ INSERT DATA INTO admin.employees TABLE
    // -------------------------------------
    const result = await ambarsariyaPool.query(
      `INSERT INTO admin.employees
        (department_id, role_name, permission_id, username, password, name, phone, email, age, start_date)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        department,
        role_name,
        rights,
        username,
        hashedPassword,
        name,
        phone,
        email,
        age,
        start_date,
      ]
    );

    const employeeId = result.rows[0]?.id;

    if (!employeeId) {
      return resp.status(500).json({
        message: "Error creating employee entry",
      });
    }

    // -------------------------------------
    // 4️⃣ SEND EMAIL WITH PASSWORD
    // -------------------------------------
    if (email) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const mailOptions = {
        from: process.env.SMTP_USER,
        to: email,
        subject: "🎉 Employee Login Credentials | Ambarsariya Mall",
        html: `
          <h2>Hello ${name},</h2>
          <p>Your employee profile has been created successfully.</p>
          <p><strong>Login Details:</strong></p>
          <p><b>Username:</b> ${username}</p>
          <p><b>Password:</b> ${password}</p>
          <br />
          <p>Regards,<br>Ambarsariya Mall Team</p>
        `,
      };

      await transporter.sendMail(mailOptions);
    }

    // -------------------------------------
    // 5️⃣ SUCCESS RESPONSE
    // -------------------------------------
    return resp.status(201).json({
      message: "Role & Employee created successfully",
      employee_id: employeeId,
    });

  } catch (err) {
    console.error("Error creating role employee:", err);
    return resp.status(500).json({
      message: "Internal Server Error",
      error: err.message,
    });
  }
};


module.exports = {
    get_departments,
    get_permissions,
    get_staff_types,
    get_role_employees,
    create_role_employee,
    get_staff
};