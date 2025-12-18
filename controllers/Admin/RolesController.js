const { createDbPool } = require("../../db_config/db");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

const ambarsariyaPool = createDbPool();

const get_departments = async (req, res) => {
  try {
    const result = await ambarsariyaPool.query(
      "SELECT * FROM admin.departments ORDER BY department_name"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching departments:", err);
    res.status(500).json({ error: "Failed to fetch departments" });
  }
};

const get_permissions = async (req, res) => {
  try {
    const result = await ambarsariyaPool.query(
      "SELECT * FROM admin.permissions"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching permissions:", err);
    res.status(500).json({ error: "Failed to fetch permissions" });
  }
};

const get_staff_types = async (req, res) => {
  try {
    const result = await ambarsariyaPool.query(
      "SELECT * FROM admin.staff_types"
    );
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
        ac.email, 
        ac.username, 
        e.age, 
        e.start_date, 
        ac.phone, 
        d.department_name 
    FROM admin.employees e
    LEFT JOIN admin.auth_credentials ac ON ac.id = e.credentials
    LEFT JOIN admin.departments d ON d.id = e.department_id
    LEFT JOIN admin.permissions rp ON rp.id = e.permission_id`);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching employee:", err);
    res.status(500).json({ error: "Failed to fetch employee" });
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
      SELECT e.id, e.department_id
      FROM admin.auth_credentials ac
      LEFT JOIN admin.employees e ON e.credentials = ac.id
      WHERE ac.access_token = $1
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
        ac.email,
        ac.username,
        s.age,
        s.start_date,
        s.assign_area,
        s.assign_area_name,
        ac.phone,
        d.department_name
      FROM admin.staff s
      LEFT JOIN admin.auth_credentials ac ON ac.id = s.credentials
      LEFT JOIN admin.staff_types st ON st.id = s.staff_type_id
      LEFT JOIN admin.employees e ON e.id = s.manager_id
      LEFT JOIN admin.departments d ON d.id = e.department_id
      WHERE s.manager_id = $1 and ac.username is not null and s.assign_area is not null
      `,
      [employeeId]
    );

    res.json(staffResult.rows);
  } catch (err) {
    console.error("Error fetching staff:", err);
    res.status(500).json({ error: "Failed to fetch staff" });
  }
};


const get_staff_with_type = async (req, res) => {
  try {
    const token = req.params.token;
    const staff_type = req.params.staff_type;

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
        s.id,
        s.name,
        st.staff_type_name,
        s.email,
        s.username,
        s.age,
        s.start_date,
        s.assign_area,
        s.assign_area_name,
        s.phone
      FROM admin.staff s
      LEFT JOIN admin.staff_types st ON st.id = s.staff_type_id
      LEFT JOIN admin.employees e ON e.id = s.manager_id
      WHERE s.manager_id = $1 and s.username is not null and s.assign_area is not null and st.staff_type_name = $2
      `,
      [employeeId, staff_type]
    );

    res.json(staffResult.rows);
  } catch (err) {
    console.error("Error fetching staff:", err);
    res.status(500).json({ error: "Failed to fetch staff" });
  }
};

// const create_role_employee = async (req, resp) => {
//   console.log(req.body);
//   const {
//     department,
//     role_name,
//     rights,
//     username,
//     password,
//     name,
//     phone,
//     email,
//     age,
//     start_date,
//   } = req.body;

//   try {
//     // -------------------------------------
//     // 1️⃣ VALIDATION: Check required fields
//     // -------------------------------------
//     if (!department || !role_name || !rights || !username || !password) {
//       return resp.status(400).json({ message: "Missing required fields" });
//     }

//     // -------------------------------------
//     // 2️⃣ HASH PASSWORD
//     // -------------------------------------
//     const hashedPassword = await bcrypt.hash(password, 10);

//     // -------------------------------------
//     // 3️⃣ INSERT DATA INTO admin.employees TABLE
//     // -------------------------------------
//     const result = await ambarsariyaPool.query(
//       `INSERT INTO admin.employees
//         (department_id, role_name, permission_id, username, password, name, phone, email, age, start_date)
//        VALUES
//         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
//        RETURNING id`,
//       [
//         department,
//         role_name,
//         rights,
//         username,
//         hashedPassword,
//         name,
//         phone,
//         email,
//         age,
//         start_date,
//       ]
//     );

//     const employeeId = result.rows[0]?.id;

//     if (!employeeId) {
//       return resp.status(500).json({
//         message: "Error creating employee entry",
//       });
//     }

//     // -------------------------------------
//     // 4️⃣ SEND EMAIL WITH PASSWORD
//     // -------------------------------------
//     if (email) {
//       const transporter = nodemailer.createTransport({
//         host: process.env.SMTP_HOST,
//         port: process.env.SMTP_PORT,
//         secure: process.env.SMTP_SECURE === "true",
//         auth: {
//           user: process.env.SMTP_USER,
//           pass: process.env.SMTP_PASS,
//         },
//       });

//       const mailOptions = {
//         from: process.env.SMTP_USER,
//         to: email,
//         subject: "🎉 Employee Login Credentials | Ambarsariya Mall",
//         html: `
//           <h2>Hello ${name},</h2>
//           <p>Your employee profile has been created successfully.</p>
//           <p><strong>Login Details:</strong></p>
//           <p><b>Username:</b> ${username}</p>
//           <p><b>Password:</b> ${password}</p>
//           <br />
//           <p>Regards,<br>Ambarsariya Mall Team</p>
//         `,
//       };

//       await transporter.sendMail(mailOptions);
//     }

//     // -------------------------------------
//     // 5️⃣ SUCCESS RESPONSE
//     // -------------------------------------
//     return resp.status(201).json({
//       message: "Role & Employee created successfully",
//       employee_id: employeeId,
//     });
//   } catch (err) {
//     console.error("Error creating role employee:", err);
//     return resp.status(500).json({
//       message: "Internal Server Error",
//       error: err.message,
//     });
//   }
// };


const create_role_employee = async (req, resp) => {
  const {
    credentials_id,
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
    // -----------------------------
    // 1️⃣ Validation
    // -----------------------------
    if (
      !credentials_id ||
      !department ||
      !role_name ||
      !rights ||
      !username ||
      !password ||
      !name ||
      !email
    ) {
      return resp.status(400).json({ message: "Missing required fields" });
    }

    // -----------------------------
    // 2️⃣ Hash password
    // -----------------------------
    const hashedPassword = await bcrypt.hash(password, 10);

    // -----------------------------
    // 3️⃣ Begin Transaction
    // -----------------------------
    await ambarsariyaPool.query("BEGIN");

    // -----------------------------
    // 4️⃣ Update auth_credentials
    // -----------------------------
    const credResult = await ambarsariyaPool.query(
      `
      UPDATE admin.auth_credentials
      SET
        username = $1,
        password = $2,
        phone = $3
      WHERE id = $4
        AND email_verified = true
      RETURNING id
      `,
      [username, hashedPassword, phone, credentials_id]
    );

    if (credResult.rowCount === 0) {
      throw new Error("Credentials not found or email not verified");
    }

    // -----------------------------
    // 5️⃣ Create employee
    // -----------------------------
    const employeeResult = await ambarsariyaPool.query(
      `
      INSERT INTO admin.employees
        (credentials, department_id, role_name, permission_id,
         name, age, start_date)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
      `,
      [
        credentials_id,
        department,
        role_name,
        rights,
        name,
        age,
        start_date,
      ]
    );

    const employeeId = employeeResult.rows[0]?.id;

    if (!employeeId) {
      throw new Error("Employee creation failed");
    }

    // -----------------------------
    // 6️⃣ Commit Transaction
    // -----------------------------
    await ambarsariyaPool.query("COMMIT");

    // -----------------------------
    // 7️⃣ Send Email (after commit)
    // -----------------------------
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

      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: email,
        subject: "🎉 Employee Login Credentials | Ambarsariya Mall",
        html: `
          <h2>Hello ${name},</h2>
          <p>Your employee profile has been created successfully.</p>

          <p><strong>Login Details:</strong></p>
          <p><b>Username:</b> ${username}</p>
          <p><b>Password:</b> ${password}</p>

          <p>Please log in to your dashboard using this link:</p>
          <p><a href="https://ambarsariyamall.com">
            https://ambarsariyamall.com
          </a></p>

          <br />
          <p>Regards,<br/>Ambarsariya Mall Team</p>
        `,
      });
    }

    // -----------------------------
    // 8️⃣ Success Response
    // -----------------------------
    return resp.status(201).json({
      success: true,
      message: "Employee created and credentials updated successfully",
      employee_id: employeeId,
    });

  } catch (err) {
    await ambarsariyaPool.query("ROLLBACK");
    console.error("Transaction failed:", err.message);

    return resp.status(500).json({
      message: "Failed to create employee",
      error: err.message,
    });
  } 
};

const store_email_otp = async (req, res) => {
  const { email, email_otp } = req.body;

  if (!email || !email_otp) {
    return res.status(400).json({ message: "Email & OTP required" });
  }

  try {
    const result = await ambarsariyaPool.query(
      `
      INSERT INTO admin.auth_credentials (email, email_otp)
      VALUES ($1, $2)
      RETURNING id
      `,
      [email, email_otp]
    );

    res.status(201).json({
      success: true,
      credentials_id: result.rows[0].id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to store OTP" });
  }
};


const verifyStaffEmailOtp = async (req, res) => {
  const { email, email_otp } = req.body;

  try {
    const result = await ambarsariyaPool.query(
      `
      SELECT id, email_otp
      FROM admin.auth_credentials
      WHERE email = $1
      `,
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Email not found" });
    }

    if (result.rows[0].email_otp !== email_otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Mark verified & clear OTP
    await ambarsariyaPool.query(
      `
      UPDATE admin.auth_credentials
      SET email_verified = true
      WHERE email = $1
      `,
      [email]
    );

    return res.json({
      success: true,
      message: "Email verified successfully",
      credentials_id: result.rows[0].id 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "OTP verification failed" });
  }
};


const create_staff = async (req, resp) => {
  const {
    credentials_id,
    manager_id,
    staff_type_id,
    name,
    age,
    start_date,
    assign_area,
    assign_area_name,
    username,
    password,
    phone,
    email,
  } = req.body;

  try {

    // -----------------------------
    // 2️⃣ Hash password
    // -----------------------------
    const hashedPassword = await bcrypt.hash(password, 10);

    // -----------------------------
    // 3️⃣ Begin Transaction
    // -----------------------------
    await ambarsariyaPool.query("BEGIN");

    // -----------------------------
    // 4️⃣ Update auth_credentials
    // -----------------------------
    const credResult = await ambarsariyaPool.query(
      `
      UPDATE admin.auth_credentials
      SET
        username = $1,
        password = $2,
        phone = $3
      WHERE id = $4
        AND email_verified = true
      RETURNING id
      `,
      [username, hashedPassword, phone, credentials_id]
    );

    if (credResult.rowCount === 0) {
      throw new Error("Credentials not found or email not verified");
    }

    // -----------------------------
    // 5️⃣ Create employee
    // -----------------------------
    const staffResult = await ambarsariyaPool.query(
      `
      INSERT INTO admin.staff
        (credentials, manager_id,
        staff_type_id,
        name,
        age,
        start_date,
        assign_area,
        assign_area_name)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
      `,
      [
        credentials_id,
        manager_id,
        staff_type_id,
        name,
        age,
        start_date,
        assign_area, 
        assign_area_name
      ]
    );

    const staffId = staffResult.rows[0]?.id;

    if (!staffId) {
      throw new Error("staff creation failed");
    }

    // -----------------------------
    // 6️⃣ Commit Transaction
    // -----------------------------
    await ambarsariyaPool.query("COMMIT");

    // -----------------------------
    // 7️⃣ Send Email (after commit)
    // -----------------------------
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

      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: email,
        subject: "🎉 Staff Login Credentials | Ambarsariya Mall",
        html: `
          <h2>Hello ${name},</h2>
          <p>Your staff profile has been created successfully.</p>

          <p><strong>Login Details:</strong></p>
          <p><b>Username:</b> ${username}</p>
          <p><b>Password:</b> ${password}</p>

          <p>Please log in to your dashboard using this link:</p>
          <p><a href="https://ambarsariyamall.com">
            https://ambarsariyamall.com
          </a></p>

          <br />
          <p>Regards,<br/>Ambarsariya Mall Team</p>
        `,
      });
    }

    // -----------------------------
    // 8️⃣ Success Response
    // -----------------------------
    return resp.status(201).json({
      success: true,
      message: "Staff created successfully",
      staff_id: staffId,
    });

  } catch (err) {
    await ambarsariyaPool.query("ROLLBACK");
    console.error("Transaction failed:", err.message);

    return resp.status(500).json({
      message: "Failed to create staff",
      error: err.message,
    });
  } 
};

// const create_staff = async (req, resp) => {
//   const {
//     manager_id,
//     staff_type_id,
//     name,
//     age,
//     start_date,
//     assign_area,
//     assign_area_name,
//     credentials_id
//   } = req.body;

//   try {
//     // 1️⃣ Fetch credentials
//     const credResult = await ambarsariyaPool.query(
//       `
//       SELECT email, username, password
//       FROM admin.auth_credentials
//       WHERE id = $1 AND email_verified = true
//       `,
//       [credentials_id]
//     );

//     if (credResult.rowCount === 0) {
//       return resp.status(400).json({ message: "Email not verified" });
//     }

//     const { email, username, password } = credResult.rows[0];

//     // 2️⃣ Insert staff
//     const staffResult = await ambarsariyaPool.query(
//       `
//       INSERT INTO admin.staff
//       (auth_id, manager_id, staff_type_id, name, age, start_date, assign_area, assign_area_name)
//       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
//       RETURNING id
//       `,
//       [
//         credentials_id,
//         manager_id,
//         staff_type_id,
//         name,
//         age,
//         start_date,
//         JSON.stringify(assign_area),
//         assign_area_name
//       ]
//     );

//     const staffId = staffResult.rows[0].id;

//     // 3️⃣ Send email (password was generated earlier)
//     const transporter = nodemailer.createTransport({
//       host: process.env.SMTP_HOST,
//       port: process.env.SMTP_PORT,
//       secure: process.env.SMTP_SECURE === "true",
//       auth: {
//         user: process.env.SMTP_USER,
//         pass: process.env.SMTP_PASS,
//       },
//     });

//     await transporter.sendMail({
//       from: process.env.SMTP_USER,
//       to: email,
//       subject: "🎉 Staff Login Credentials | Ambarsariya Mall",
//       html: `
//         <h2>Hello ${name},</h2>
//         <p>Your staff profile has been created successfully.</p>

//         <p><strong>Login Details:</strong></p>
//         <p><b>Username:</b> ${username}</p>
//         <p><b>Password:</b> ${password}</p>

//         <p>
//           Please log in to your dashboard using this link:<br/>
//           <a href="https://ambarsariyamall.com">
//             https://ambarsariyamall.com
//           </a>
//         </p>

//         <br/>
//         <p>Regards,<br/>Ambarsariya Mall Team</p>
//       `,
//     });

//     return resp.status(201).json({
//       success: true,
//       message: "Staff created successfully",
//       staff_id: staffId,
//     });

//   } catch (err) {
//     console.error(err);
//     resp.status(500).json({ message: "Internal Server Error" });
//   }
// };




const create_staff_task = async (req, resp) => {
  const {
    assigned_by,
    assigned_to,
    assigned_task,
    start_date,
    end_date,
    assign_area,
    approx_shops ,
    approx_offices ,
    approx_hawkers,
    assign_daily_task,
    choose_date,
    daily_location
  } = req.body;

  try {
    if (!assigned_by || !assigned_to || !assigned_task || !start_date || !end_date) {
      return resp.status(400).json({ message: "Missing required fields" });
    }

    // 1️⃣ Fetch staff details
    const staffRes = await ambarsariyaPool.query(
      `SELECT name, email FROM admin.staff WHERE id = $1`,
      [assigned_to]
    );

    if (staffRes.rowCount === 0) {
      return resp.status(404).json({ message: "Staff not found" });
    }

    const { name, email } = staffRes.rows[0];

    // 2️⃣ Insert task
    const result = await ambarsariyaPool.query(
      `INSERT INTO admin.staff_tasks (
        assigned_by,
        assigned_to,
        assigned_task,
        start_date,
        end_date,
        assign_area,
        approx_shops,
        approx_offices,
        approx_hawkers,
        assign_daily_task,
        choose_date,
        daily_location
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      ) RETURNING id`,
      [
        assigned_by,
        assigned_to,
        assigned_task,
        start_date,
        end_date,
        JSON.stringify(assign_area),
        approx_shops,
        approx_offices,
        approx_hawkers,
        assign_daily_task,
        choose_date,
        JSON.stringify(daily_location)
      ]
    );

    const taskId = result.rows[0].id;

    // 3️⃣ Send mail
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
        subject: "New Task Assigned – Ambarsariya Mall",
        html: `
          <h2>Hello ${name},</h2>

          <p>A new task has been assigned to you.</p>

          <p><strong>Task:</strong> ${assigned_task}</p>
          <p><strong>Duration:</strong> ${start_date} to ${end_date}</p>

          <p>
            Please log in to your dashboard using this link:<br/>
            <a href="https://ambarsariyamall.com" target="_blank">
              https://ambarsariyamall.com
            </a>
          </p>

          <br/>
          <p>Regards,<br/>
          <strong>Ambarsariya Mall Team</strong></p>
        `,
      };

      await transporter.sendMail(mailOptions);
    }

    return resp.status(201).json({
      success: true,
      message: "Task assigned successfully",
      task_id: taskId,
    });

  } catch (err) {
    console.error(err);
    resp.status(500).json({ message: "Internal Server Error" });
  }
};



module.exports = {
  get_departments,
  get_permissions,
  get_staff_types,
  get_role_employees,
  create_role_employee,
  get_staff,
  store_email_otp,
  verifyStaffEmailOtp,
  create_staff,
  get_staff_with_type,
  create_staff_task
};
