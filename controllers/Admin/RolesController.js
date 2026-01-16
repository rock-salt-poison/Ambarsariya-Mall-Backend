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

const check_email_exists = async (req, res) => {
  const { email } = req.params;

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const result = await ambarsariyaPool.query(
      `SELECT id FROM admin.auth_credentials WHERE email = $1`,
      [normalizedEmail]
    );

    return res.status(200).json({
      success: true,
      exists: result.rowCount === 1, 
    });

  } catch (error) {
    console.error("Check email error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to check email",
    });
  }
};

const get_role_employees = async (req, res) => {
  try {
    const result = await ambarsariyaPool.query(`SELECT 
        e.id,  
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


const get_staff_members_by_manager_id = async (req, res) => {
  const {id} = req.params;
  try {
    const result = await ambarsariyaPool.query(`select s.*, ac.username, ac.email from admin.marketing_staff s
      LEFT JOIN admin.auth_credentials ac ON ac.id = s.credentials 
where s.manager_id = $1`, [id]);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching staff members:", err);
    res.status(500).json({ error: "Failed to fetch staff members" });
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
      FROM admin.marketing_staff s
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
        s.id,
        s.name,
        st.staff_type_name,
        ac.email,
        ac.username,
        s.age,
        s.start_date,
        s.assign_area,
        s.assign_area_name,
        ac.phone
      FROM admin.marketing_staff s
      LEFT JOIN admin.auth_credentials ac ON ac.id = s.credentials
      LEFT JOIN admin.staff_types st ON st.id = s.staff_type_id
      LEFT JOIN admin.employees e ON e.id = s.manager_id
      WHERE s.manager_id = $1 and ac.username is not null and s.assign_area is not null and st.staff_type_name = $2
      `,
      [employeeId, staff_type]
    );

    res.json(staffResult.rows);
  } catch (err) {
    console.error("Error fetching staff:", err);
    res.status(500).json({ error: "Failed to fetch staff" });
  }
};

const get_staff_tasks = async (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }

  try {
    const query = `
      SELECT st.*, e.name as "assigned_by_name"
      FROM admin.staff_tasks st
      JOIN admin.marketing_staff s 
        ON s.id = st.assigned_to
      JOIN admin.employees e 
        ON e.id = st.assigned_by
      JOIN admin.auth_credentials ac 
        ON ac.id = s.credentials
      WHERE ac.access_token = $1
    `;

    const result = await ambarsariyaPool.query(query, [token]);

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching tasks:", err);
    return res.status(500).json({ error: "Failed to fetch tasks" });
  }
};

const get_staff_tasks_by_reporting_date = async (req, res) => {
  const { token, task_reporting_date } = req.params;

  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }

  try {
    const query = `
      SELECT st.*, e.name as "assigned_by_name"
      FROM admin.staff_tasks st
      JOIN admin.marketing_staff s 
        ON s.id = st.assigned_to
      JOIN admin.employees e 
        ON e.id = st.assigned_by
      JOIN admin.auth_credentials ac 
        ON ac.id = s.credentials
	  JOIN admin.task_report_details trd 
	  	ON trd.task_reporting_date = $2 and trd.task_id = st.id
      WHERE ac.access_token = $1
    `;

    const result = await ambarsariyaPool.query(query, [token, task_reporting_date]);

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching tasks:", err);
    return res.status(500).json({ error: "Failed to fetch tasks" });
  }
};

const get_staff_task_with_token = async (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }

  try {
    const query = `
      SELECT st.*
      FROM admin.staff_tasks st
      WHERE st.access_token = $1
    `;

    const result = await ambarsariyaPool.query(query, [token]);

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching task details:", err);
    return res.status(500).json({ error: "Failed to fetch task details" });
  }
};

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
       `UPDATE admin.auth_credentials
       SET username = $1, password = $2, phone = $3, email_is_registered = true
       WHERE id = $4 AND email_verified = true
       RETURNING id`,
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

// const store_email_otp = async (req, res) => {
//   const { email, email_otp } = req.body;

//   if (!email || !email_otp) {
//     return res.status(400).json({ message: "Email & OTP required" });
//   }
//   const normalizedEmail = email.trim().toLowerCase();

//   try {
//     const result = await ambarsariyaPool.query(
//       `
//       INSERT INTO admin.auth_credentials (email, email_otp)
//       VALUES ($1, $2)
//       RETURNING id
//       `,
//       [normalizedEmail, email_otp]
//     );

//     res.status(201).json({
//       success: true,
//       credentials_id: result.rows[0].id,
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Failed to store OTP" });
//   }
// };

// const verifyStaffEmailOtp = async (req, res) => {
//   const { email, email_otp } = req.body;

//   const normalizedEmail = email.trim().toLowerCase();
//   try {

//     const result = await ambarsariyaPool.query(
//       `
//       SELECT id, email_otp
//       FROM admin.auth_credentials
//       WHERE email = $1
//       `,
//       [normalizedEmail]
//     );

//     if (result.rowCount === 0) {
//       return res.status(404).json({ message: "Email not found" });
//     }

//     if (result.rows[0].email_otp !== email_otp) {
//       return res.status(400).json({ message: "Invalid OTP" });
//     }

//     // Mark verified & clear OTP
//     await ambarsariyaPool.query(
//       `
//       UPDATE admin.auth_credentials
//       SET email_verified = true
//       WHERE email = $1
//       `,
//       [normalizedEmail]
//     );

//     return res.json({
//       success: true,
//       message: "Email verified successfully",
//       credentials_id: result.rows[0].id 
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "OTP verification failed" });
//   }
// };


const store_email_otp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  try {
    const existing = await ambarsariyaPool.query(
      `SELECT id, email_verified, otp_created_at AT TIME ZONE 'UTC' AS otp_created_at
       FROM admin.auth_credentials
       WHERE email = $1`,
      [normalizedEmail]
    );

    const now = new Date();
    let credentialsId;
    let sendEmail = false;

    if (existing.rowCount > 0) {
      const row = existing.rows[0];

      if (row.email_verified) {
        return res.status(400).json({ message: "Email already registered" });
      }

      if (row.otp_created_at) {
        const diffMinutes =
          (now - new Date(row.otp_created_at)) / 1000 / 60;
        console.log(diffMinutes, otp);
        
        if (diffMinutes <= 5) {
          return res.status(200).json({
            success: true,
            message: "OTP already sent",
            credentials_id: row.id,
          });
        }
      }

      await ambarsariyaPool.query(
        `UPDATE admin.auth_credentials
         SET email_otp = $1,
             otp_created_at = NOW(),
             email_verified = false
         WHERE email = $2`,
        [otp, normalizedEmail]
      );

      credentialsId = row.id;
      sendEmail = true;
    } else {
      const insert = await ambarsariyaPool.query(
        `INSERT INTO admin.auth_credentials
         (email, email_otp, otp_created_at, email_verified)
         VALUES ($1, $2, NOW(), false)
         RETURNING id`,
        [normalizedEmail, otp]
      );

      credentialsId = insert.rows[0].id;
      sendEmail = true;
    }

    if (sendEmail) {
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
        to: normalizedEmail,
        subject: "Email OTP",
        html: `<p>Your OTP is <b>${otp}</b>. Valid for 5 minutes.</p>`,
      });
    }

    res.json({
      success: true,
      credentials_id: credentialsId,
      message: sendEmail ? "OTP sent" : "OTP already valid",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "OTP error" });
  }
};




const verifyStaffEmailOtp = async (req, res) => {
  const { email, email_otp } = req.body;
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const result = await ambarsariyaPool.query(
      `SELECT id, email_otp, otp_created_at AT TIME ZONE 'UTC' AS created_at
       FROM admin.auth_credentials
       WHERE email = $1`,
      [normalizedEmail]
    );

    if (result.rowCount === 0) return res.status(404).json({ message: "Email not found" });

    const row = result.rows[0];

    // OTP expired check → 5 minutes
    const otpAge = (new Date() - new Date(row.created_at)) / 1000 / 60; // minutes
    if (otpAge > 5) return res.status(400).json({ message: "OTP expired" });
    console.log(otpAge);
    
    if (row.email_otp !== email_otp) return res.status(400).json({ message: "Invalid OTP" });

    // Mark verified & clear OTP
    await ambarsariyaPool.query(
      `UPDATE admin.auth_credentials
       SET email_verified = true, email_otp = NULL
       WHERE email = $1`,
      [normalizedEmail]
    );

    res.json({ success: true, message: "Email verified successfully", credentials_id: row.id });
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
        phone = $3,
        email_is_registered = true
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
      INSERT INTO admin.marketing_staff
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
      `SELECT s.name, ac.email 
       FROM admin.marketing_staff s
       LEFT JOIN admin.auth_credentials ac ON ac.id = s.credentials
       WHERE s.id = $1 `,
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
          <p><strong>Duration:</strong> ${start_date.split('T')?.[0]} to ${end_date?.split('T')?.[0]}</p>

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

// const create_task_report = async (req, res) => {
//   try {
//     console.log(req.body);
    
//     const { formData, clientSummaries } = req.body;

//     // 1️⃣ Insert task_report_details
//     const taskReportQuery = `
//       INSERT INTO admin.task_report_details (
//         task_id,
//         task_reporting_date,
//         visits,
//         joined,
//         in_pipeline,
//         total_leads_summary,
//         daily_leads_summary,
//         total_client_summary,
//         daily_client_summary,
//         total_capture_summary,
//         daily_capture_summary,
//         total_confirmation,
//         daily_confirmation
//       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
//       RETURNING id
//     `;

//     const taskReportValues = [
//       formData.task_id,
//       formData.task_reporting_date,
//       formData.visits || 0,
//       formData.joined || 0,
//       formData.in_pipeline || 0,
//       formData.total_leads || 0,
//       formData.daily_leads || 0,
//       formData.total_client || 0,
//       formData.daily_client || 0,
//       formData.total_capture || 0,
//       formData.daily_capture || 0,
//       formData.total_confirmation || 0,
//       formData.Daily_confirmation || 0
//     ];

//     const { rows } = await ambarsariyaPool.query(taskReportQuery, taskReportValues);
//     const task_report_id = rows[0].id;

//     // 2️⃣ Insert clientSummaries
//     let summary_group_counter = 1;

//     for (const group of clientSummaries) {
//       const group_id = summary_group_counter++;
//       let parent_id_map = {};

//       for (const stage of group.stages) {
//         let parent_summary_id = null;
//         if (stage.type === 'Capture Summary') parent_summary_id = parent_id_map['Client Summary'];
//         else if (stage.type === 'Confirm Summary') parent_summary_id = parent_id_map['Capture Summary'];

//         const stageData = stage.data || {};

//         let action_value = null;

//         if (stage.type === "Client Summary") {
//           action_value = stageData.client_action || null;
//         } 
//         else if (stage.type === "Capture Summary") {
//           action_value = stageData.capture_action || null;
//         } 
//         else if (stage.type === "Confirm Summary") {
//           action_value = stageData.confirm_action || null;
//         }

//         const insertStageQuery = `
//           INSERT INTO admin.task_summaries (
//             task_report_id,
//             summary_group_id,
//             parent_summary_id,
//             summary_type,
//             status,
//             name,
//             phone,
//             email,
//             shop_name,
//             shop_domain,
//             shop_sector,
//             action,
//             shop_no,
//             location
//           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
//           RETURNING id
//         `;

//         const stageValues = [
//           task_report_id,
//           group_id,
//           parent_summary_id,
//           stage.type,
//           stage.status,
//           stageData.name || null,
//           stageData.phone || null,
//           stageData.email || null,
//           stageData.shop || null,
//           stageData.domain || null,
//           stageData.sector || null,
//           action_value || null,
//           stageData.shop_no || null,
//           stageData.location || null
//         ];

//         const { rows: stageRows } = await ambarsariyaPool.query(insertStageQuery, stageValues);
//         parent_id_map[stage.type] = stageRows[0].id;
//       }
//     }

//     res.status(201).json({ success: true, task_report_id });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

const create_or_update_task_report = async (req, res) => {
  try {
    const { formData, clientSummaries } = req.body;

    // Check existing report
    const checkQuery = `
      SELECT id FROM admin.task_report_details
      WHERE task_id = $1 AND task_reporting_date = $2
    `;

    const existing = await ambarsariyaPool.query(checkQuery, [
      formData.task_id,
      formData.task_reporting_date
    ]);

    let task_report_id;

    if (existing.rows.length) {
      // UPDATE
      task_report_id = existing.rows[0].id;

      await ambarsariyaPool.query(`
        UPDATE admin.task_report_details
        SET
          visits=$3,
          joined=$4,
          in_pipeline=$5,
          total_leads_summary=$6,
          daily_leads_summary=$7,
          total_client_summary=$8,
          daily_client_summary=$9,
          total_capture_summary=$10,
          daily_capture_summary=$11,
          total_confirmation=$12,
          daily_confirmation=$13
        WHERE id=$1 AND task_reporting_date=$2
      `, [
        task_report_id,
        formData.task_reporting_date,
        formData.visits || 0,
        formData.joined || 0,
        formData.in_pipeline || 0,
        formData.total_leads || 0,
        formData.daily_leads || 0,
        formData.total_client || 0,
        formData.daily_client || 0,
        formData.total_capture || 0,
        formData.daily_capture || 0,
        formData.total_confirmation || 0,
        formData.Daily_confirmation || 0
      ]);

      // Extract summary_group_id from clientSummaries
      const summaryGroupIds = [];
      for (const group of clientSummaries) {
        // Check for summary_group_id first (from API data), then fallback to id (from UI)
        const groupId = group.summary_group_id !== undefined && group.summary_group_id !== null
          ? group.summary_group_id
          : (group.id !== undefined && group.id !== null && typeof group.id === 'number')
            ? group.id
            : null;
        
        if (groupId !== null) {
          summaryGroupIds.push(groupId);
        }
      }

      // Remove old summaries only for the specific summary_group_ids being updated
      if (summaryGroupIds.length > 0) {
        await ambarsariyaPool.query(
          `DELETE FROM admin.task_summaries 
           WHERE task_report_id = $1 AND summary_group_id = ANY($2::int[])`,
          [task_report_id, summaryGroupIds]
        );
      }

    } else {
      // INSERT
      const insert = await ambarsariyaPool.query(`
        INSERT INTO admin.task_report_details (
          task_id,
          task_reporting_date,
          visits,
          joined,
          in_pipeline,
          total_leads_summary,
          daily_leads_summary,
          total_client_summary,
          daily_client_summary,
          total_capture_summary,
          daily_capture_summary,
          total_confirmation,
          daily_confirmation
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING id
      `, [
        formData.task_id,
        formData.task_reporting_date,
        formData.visits || 0,
        formData.joined || 0,
        formData.in_pipeline || 0,
        formData.total_leads || 0,
        formData.daily_leads || 0,
        formData.total_client || 0,
        formData.daily_client || 0,
        formData.total_capture || 0,
        formData.daily_capture || 0,
        formData.total_confirmation || 0,
        formData.Daily_confirmation || 0
      ]);

      task_report_id = insert.rows[0].id;
    }

    // Insert summaries
    let groupCounter = 1;

    for (const group of clientSummaries) {
      // Use summary_group_id first (from API data), then id (from UI), otherwise use counter
      const groupId = group.summary_group_id !== undefined && group.summary_group_id !== null
        ? group.summary_group_id
        : (group.id !== undefined && group.id !== null && typeof group.id === 'number')
          ? group.id
          : groupCounter++;
      const parentMap = {};

      for (const stage of group.stages) {
        let parent_id = null;
        if (stage.type === "Capture Summary") {
          parent_id = parentMap["Client Summary"];
        }
        if (stage.type === "Confirm Summary") {
          parent_id = parentMap["Capture Summary"];
        }

        const d = stage.data || {};

        const actionObject = {};

if (Array.isArray(d.client_action) && d.client_action.length) {
  actionObject.client_action = d.client_action;
}
if (Array.isArray(d.capture_action) && d.capture_action.length) {
  actionObject.capture_action = d.capture_action;
}
if (Array.isArray(d.confirm_action) && d.confirm_action.length) {
  actionObject.confirm_action = d.confirm_action;
}

const finalAction =
  Object.keys(actionObject).length > 0 ? actionObject : null;
        const result = await ambarsariyaPool.query(`
          INSERT INTO admin.task_summaries (
            task_report_id,
            summary_group_id,
            parent_summary_id,
            summary_type,
            status,
            name,
            phone,
            email,
            shop_name,
            shop_domain,
            shop_sector,
            action,
            shop_no,
            location
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
          RETURNING id
        `, [
          task_report_id,
          groupId,
          parent_id,
          stage.type,
          stage.status,
          d.name || "",
          d.phone || "",
          d.email || "",
          d.shop || "",
          d.domain || null,
          d.sector || null,
          finalAction ? finalAction : null,
          d.shop_no || "",
          d.location || null
        ]);

        parentMap[stage.type] = result.rows[0].id;

        // Send email if conditions are met: Capture Summary, status is confirm, action is Form 1, and email is not empty
        let isForm1Action = false;
        
        // Check if capture_action is a string (from form submission)
        if (d.capture_action && typeof d.capture_action === 'string') {
          isForm1Action = d.capture_action.toLowerCase().trim() === "form 1";
        }
        // Check if capture_action is in the actionObject array format
        else if (actionObject.capture_action && Array.isArray(actionObject.capture_action)) {
          isForm1Action = actionObject.capture_action.some(action => {
            if (typeof action === 'string') {
              return action.toLowerCase().trim() === "form 1";
            } else if (typeof action === 'object' && action.action) {
              return action.action.toLowerCase().trim() === "form 1";
            }
            return false;
          });
        }

        if (
          stage.type === "Capture Summary" &&
          stage.status &&
          stage.status.toLowerCase() === "confirm" &&
          isForm1Action &&
          d.email &&
          d.email.trim() !== ""
        ) {
          try {
            // Fetch domain name and sector name
            let domainName = 'N/A';
            let sectorName = 'N/A';

            if (d.domain) {
              const domainResult = await ambarsariyaPool.query(
                `SELECT domain_name FROM public.domains WHERE domain_id = $1`,
                [d.domain]
              );
              if (domainResult.rows.length > 0) {
                domainName = domainResult.rows[0].domain_name;
              }
            }

            if (d.sector) {
              const sectorResult = await ambarsariyaPool.query(
                `SELECT sector_name FROM public.sectors WHERE sector_id = $1`,
                [d.sector]
              );
              if (sectorResult.rows.length > 0) {
                sectorName = sectorResult.rows[0].sector_name;
              }
            }

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
              to: d.email.trim(),
              subject: "Welcome to Ambarsariya Mall",
              html: `
                <h2>Welcome to Ambarsariya Mall</h2>
                
                <p>You can create your shop in standard fit infrastructure in which you have to give 30 discount coupons per month + registration charges</p>
                
                <p><strong>Domain:</strong> ${domainName}</p>
                <p><strong>Sector:</strong> ${sectorName}</p>
                <p><strong>Shop Name:</strong> ${d.shop}</p>
                <p><strong>Location:</strong> ${d.location.formatted_address}</p>
                
                <p>
                  <a href="https://ambarsariyamall.shop/sell/coupon-offering" target="_blank">
                    Coupon-offerings page link
                  </a>
                </p>
                
                <p>* You can skip coupon and registration fee for demo model</p>
                
                <br/>
                <p>Regards,<br/>
                <strong>Ambarsariya Mall Team</strong></p>
              `,
            };

            await transporter.sendMail(mailOptions);
            console.log(`Email sent successfully to ${d.email} for Form 1 action`);
          } catch (emailError) {
            console.error(`Error sending email to ${d.email}:`, emailError);
            // Don't fail the entire request if email fails
          }
        }
      }
    }

    res.json({ success: true, task_report_id });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};


const get_staff_member_tasks = async (req, res) => {
  const { assigned_by, assigned_to } = req.params;

  try {
    const query = `
      SELECT st.*
      FROM admin.staff_tasks st
      WHERE st.assigned_to = $1 and st.assigned_by = $2
    `;

    const result = await ambarsariyaPool.query(query, [assigned_to, assigned_by]);

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching tasks:", err);
    return res.status(500).json({ error: "Failed to fetch tasks" });
  }
};

const get_grouped_staff_task_report_details = async (req, res) => {
  try {
    const {task_id, task_reporting_date} = req.params;

    const staffReportResult = await ambarsariyaPool.query(
      `
      WITH filtered_reports AS (
        SELECT id, task_id, task_reporting_date
        FROM admin.task_report_details
        WHERE task_id = $1
          AND task_reporting_date = $2
      ),

      report_totals AS (
        SELECT
          trd.task_id,
          trd.task_reporting_date,
          st.access_token,

          SUM(visits)                AS visits,
          SUM(joined)                AS joined,
          SUM(in_pipeline)           AS in_pipeline,

          SUM(total_leads_summary)   AS total_leads_summary,
          SUM(daily_leads_summary)   AS daily_leads_summary,

          SUM(total_client_summary)  AS total_client_summary,
          SUM(daily_client_summary)  AS daily_client_summary,

          SUM(total_capture_summary) AS total_capture_summary,
          SUM(daily_capture_summary) AS daily_capture_summary,

          SUM(total_confirmation)    AS total_confirmation,
          SUM(daily_confirmation)    AS daily_confirmation
        FROM filtered_reports fr
        JOIN admin.task_report_details trd ON trd.id = fr.id
        JOIN admin.staff_tasks st ON st.id = fr.task_id
        GROUP BY trd.task_id, trd.task_reporting_date, st.access_token
      ),

      prioritized_summaries AS (
        SELECT *
        FROM (
          SELECT 
            ts.*,

            d.domain_name,
            s.sector_name,

            ROW_NUMBER() OVER (
              PARTITION BY ts.summary_group_id, ts.task_report_id
              ORDER BY
                CASE ts.summary_type
                  WHEN 'client' THEN 1
                  WHEN 'capture' THEN 2
                  WHEN 'confirm' THEN 3
                  ELSE 4
                END DESC,  -- highest priority last
                ts.id DESC
            ) AS rn
          FROM admin.task_summaries ts
          LEFT JOIN public.domains d
            ON ts.shop_domain = d.domain_id
          LEFT JOIN public.sectors s
            ON ts.shop_sector = s.sector_id
          WHERE ts.task_report_id IN (SELECT id FROM filtered_reports)
        ) t
        WHERE rn = 1
      ),

      task_summary_list AS (
        SELECT json_agg(
                 json_build_object(
                   'id', ts.id,
                   'task_report_id', ts.task_report_id,
                   'summary_type', ts.summary_type,
                   'summary_group_id', ts.summary_group_id,
                   'parent_summary_id', ts.parent_summary_id,
                   'status', ts.status,
                   'name', ts.name,
                   'phone', ts.phone,
                   'email', ts.email,
                   'shop_name', ts.shop_name,
                   'shop_domain', ts.domain_name,
                   'shop_sector', ts.sector_name,
                   'action', ts.action,
                   'shop_no', ts.shop_no,
                   'location', ts.location,
                   'created_at', ts.created_at
                 )
                 ORDER BY ts.id
               ) AS summaries
        FROM prioritized_summaries ts
      )

      SELECT
        rt.*,
        tsl.summaries
      FROM report_totals rt
      CROSS JOIN task_summary_list tsl;
      `,
      [task_id, task_reporting_date]
    );

    if (staffReportResult.rows.length === 0) {
      return res.json({ message: "No data exists." });
    }

    res.json(staffReportResult.rows);
  } catch (err) {
    console.error("Error fetching staff report:", err);
    res.status(500).json({ error: "Failed to fetch staff report" });
  }
};

const get_staff_task_report_details = async (req, res) => {
  try {
    const {task_id, task_reporting_date} = req.params;

    const staffReportResult = await ambarsariyaPool.query(
      `
      WITH filtered_reports AS (
        SELECT id, task_id, task_reporting_date
        FROM admin.task_report_details
        WHERE task_id = $1
          AND task_reporting_date = $2
      ),

      all_task_reports AS (
        SELECT id, task_id, task_reporting_date
        FROM admin.task_report_details
        WHERE task_id = $1
      ),

      all_reports_daily_totals AS (
        SELECT
          SUM(trd.daily_leads_summary) AS total_leads_summary,
          SUM(trd.daily_client_summary) AS total_client_summary,
          SUM(trd.daily_capture_summary) AS total_capture_summary,
          SUM(trd.daily_confirmation)  AS total_confirmation
        FROM all_task_reports atr
        JOIN admin.task_report_details trd
          ON trd.id = atr.id
      ),

      daily_report_data AS (
        SELECT
          trd.task_id,
          trd.task_reporting_date,
          trd.visits,
          trd.joined,
          trd.in_pipeline,
          trd.daily_leads_summary,
          trd.daily_client_summary,
          trd.daily_capture_summary,
          trd.daily_confirmation
        FROM filtered_reports fr
        JOIN admin.task_report_details trd
          ON trd.id = fr.id
        LIMIT 1
      ),

      report_totals AS (
        SELECT
          COALESCE(drd.task_id, $1::int) AS task_id,
          COALESCE(drd.task_reporting_date, $2::date) AS task_reporting_date,
          COALESCE(drd.visits, 0) AS visits,
          COALESCE(drd.joined, 0) AS joined,
          COALESCE(drd.in_pipeline, 0) AS in_pipeline,
          COALESCE(art.total_leads_summary, 0) AS total_leads_summary,
          COALESCE(art.total_client_summary, 0) AS total_client_summary,
          COALESCE(art.total_capture_summary, 0) AS total_capture_summary,
          COALESCE(art.total_confirmation, 0) AS total_confirmation,
          COALESCE(drd.daily_leads_summary, 0) AS daily_leads_summary,
          COALESCE(drd.daily_client_summary, 0) AS daily_client_summary,
          COALESCE(drd.daily_capture_summary, 0) AS daily_capture_summary,
          COALESCE(drd.daily_confirmation, 0) AS daily_confirmation
        FROM all_reports_daily_totals art
        LEFT JOIN daily_report_data drd ON TRUE
      ),

      task_summary_list AS (
        SELECT
          json_agg(
            json_build_object(
              'id', ts.id,
              'task_report_id', ts.task_report_id,
              'summary_type', ts.summary_type,
              'summary_type', ts.summary_type,
              'parent_summary_id', ts.parent_summary_id,
              'status', ts.status,
              'name', ts.name,
              'phone', ts.phone,
              'email', ts.email,
              'shop_name', ts.shop_name,
              'shop_domain', ts.shop_domain,
              'shop_domain_name', d.domain_name,
              'shop_sector', ts.shop_sector,
              'shop_sector_name', s.sector_name,
              'action', ts.action,
              'shop_no', ts.shop_no,
              'location', ts.location,
              'created_at', ts.created_at
            )
            ORDER BY ts.id
          ) AS summaries
        FROM admin.task_summaries ts
        LEFT JOIN public.domains d
        ON ts.shop_domain = d.domain_id
        LEFT JOIN public.sectors s
        ON ts.shop_sector = s.sector_id
        WHERE ts.task_report_id IN (
          SELECT id FROM filtered_reports
        )
      )

      SELECT
        rt.*,
        COALESCE(tsl.summaries, '[]'::json) AS summaries
      FROM report_totals rt
      LEFT JOIN task_summary_list tsl ON TRUE;
      `,
      [task_id, task_reporting_date]
    );

    if (staffReportResult.rows.length === 0) {
      return res.json({ message: "No data exists." });
    }

    res.json(staffReportResult.rows);
  } catch (err) {
    console.error("Error fetching staff report:", err);
    res.status(500).json({ error: "Failed to fetch staff report" });
  }
};

const get_all_staff_reports_by_token = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    const staffReportResult = await ambarsariyaPool.query(
      `
      WITH staff_tasks_filtered AS (
        SELECT st.id as task_id, st.access_token
        FROM admin.staff_tasks st
        JOIN admin.marketing_staff s ON s.id = st.assigned_to
        JOIN admin.auth_credentials ac ON ac.id = s.credentials
        WHERE ac.access_token = $1
      ),

      all_reports AS (
        SELECT 
          trd.id as task_report_id,
          trd.task_id,
          trd.task_reporting_date,
          stf.access_token
        FROM admin.task_report_details trd
        JOIN staff_tasks_filtered stf ON stf.task_id = trd.task_id
        ORDER BY trd.task_reporting_date DESC
      ),

      prioritized_summaries AS (
        SELECT *
        FROM (
          SELECT 
            ts.*,
            d.domain_name,
            s.sector_name,
            ROW_NUMBER() OVER (
              PARTITION BY ts.summary_group_id, ts.task_report_id
              ORDER BY
                CASE LOWER(ts.summary_type)
                  WHEN 'client summary' THEN 1
                  WHEN 'capture summary' THEN 2
                  WHEN 'confirm summary' THEN 3
                  WHEN 'client' THEN 1
                  WHEN 'capture' THEN 2
                  WHEN 'confirm' THEN 3
                  ELSE 4
                END DESC,  -- highest priority last
                ts.id DESC
            ) AS rn
          FROM admin.task_summaries ts
          LEFT JOIN public.domains d
            ON ts.shop_domain = d.domain_id
          LEFT JOIN public.sectors s
            ON ts.shop_sector = s.sector_id
          WHERE ts.task_report_id IN (SELECT task_report_id FROM all_reports)
        ) t
        WHERE rn = 1
      ),

      task_summary_list AS (
        SELECT
          ts.task_report_id,
          json_agg(
            json_build_object(
              'id', ts.id,
              'task_report_id', ts.task_report_id,
              'summary_type', ts.summary_type,
              'summary_group_id', ts.summary_group_id,
              'parent_summary_id', ts.parent_summary_id,
              'status', ts.status,
              'name', ts.name,
              'phone', ts.phone,
              'email', ts.email,
              'shop_name', ts.shop_name,
              'shop_domain', ts.shop_domain,
              'shop_domain_name', ts.domain_name,
              'shop_sector', ts.shop_sector,
              'shop_sector_name', ts.sector_name,
              'action', ts.action,
              'shop_no', ts.shop_no,
              'location', ts.location,
              'created_at', ts.created_at
            )
            ORDER BY ts.id
          ) AS summaries
        FROM prioritized_summaries ts
        GROUP BY ts.task_report_id
      )

      SELECT
        ar.task_report_id,
        ar.task_id,
        ar.task_reporting_date,
        ar.access_token,
        COALESCE(tsl.summaries, '[]'::json) AS summaries
      FROM all_reports ar
      LEFT JOIN task_summary_list tsl ON tsl.task_report_id = ar.task_report_id
      ORDER BY ar.task_reporting_date DESC
      `,
      [token]
    );

    if (staffReportResult.rows.length === 0) {
      return res.json([]);
    }

    res.json(staffReportResult.rows);
  } catch (err) {
    console.error("Error fetching all staff reports:", err);
    res.status(500).json({ error: "Failed to fetch staff reports" });
  }
};

const get_selected_staff_task_report = async (req, res) => {
  try {
    const {task_id, task_reporting_date, summary_group_id, access_token} = req.params;

    const staffReportResult = await ambarsariyaPool.query(
      `
      WITH filtered_reports AS (
      SELECT
          trd.id,
          trd.task_id,
          trd.task_reporting_date
      FROM admin.task_report_details trd
      JOIN admin.staff_tasks st
        ON st.id = trd.task_id
      WHERE trd.task_id = $1
        AND trd.task_reporting_date = $2
        AND st.access_token = $3
  ),

  all_task_reports AS (
      SELECT
          trd.id,
          trd.task_id,
          trd.task_reporting_date
      FROM admin.task_report_details trd
      JOIN admin.staff_tasks st
        ON st.id = trd.task_id
      WHERE trd.task_id = $1
        AND st.access_token = $3
  ),

  all_reports_daily_totals AS (
      SELECT
          SUM(trd.daily_leads_summary) AS total_leads_summary,
          SUM(trd.daily_client_summary) AS total_client_summary,
          SUM(trd.daily_capture_summary) AS total_capture_summary,
          SUM(trd.daily_confirmation)  AS total_confirmation
      FROM all_task_reports atr
      JOIN admin.task_report_details trd
        ON trd.id = atr.id
  ),

  daily_report_data AS (
      SELECT
          trd.task_id,
          trd.task_reporting_date,
          trd.visits,
          trd.joined,
          trd.in_pipeline,
          trd.daily_leads_summary,
          trd.daily_client_summary,
          trd.daily_capture_summary,
          trd.daily_confirmation
      FROM filtered_reports fr
      JOIN admin.task_report_details trd
        ON trd.id = fr.id
      LIMIT 1
  ),

  report_totals AS (
      SELECT
          COALESCE(drd.task_id, $1::int) AS task_id,
          COALESCE(drd.task_reporting_date, $2::date) AS task_reporting_date,
          COALESCE(drd.visits, 0) AS visits,
          COALESCE(drd.joined, 0) AS joined,
          COALESCE(drd.in_pipeline, 0) AS in_pipeline,
          COALESCE(art.total_leads_summary, 0) AS total_leads_summary,
          COALESCE(art.total_client_summary, 0) AS total_client_summary,
          COALESCE(art.total_capture_summary, 0) AS total_capture_summary,
          COALESCE(art.total_confirmation, 0) AS total_confirmation,
          COALESCE(drd.daily_leads_summary, 0) AS daily_leads_summary,
          COALESCE(drd.daily_client_summary, 0) AS daily_client_summary,
          COALESCE(drd.daily_capture_summary, 0) AS daily_capture_summary,
          COALESCE(drd.daily_confirmation, 0) AS daily_confirmation
      FROM all_reports_daily_totals art
      LEFT JOIN daily_report_data drd ON TRUE
  ),

  task_summary_list AS (
    SELECT
        json_agg(
            CASE
                /* ✅ SELECTED GROUP → FULL DATA */
                WHEN ts.summary_group_id = $4 THEN
                    json_build_object(
                        'id', ts.id,
                        'task_report_id', ts.task_report_id,
                        'summary_type', ts.summary_type,
                        'parent_summary_id', ts.parent_summary_id,
                        'summary_group_id', ts.summary_group_id,
                        'status', ts.status,
                        'action', ts.action,

                        'name', ts.name,
                        'phone', ts.phone,
                        'email', ts.email,
                        'shop_name', ts.shop_name,
                        'shop_domain', ts.shop_domain,
                        'shop_domain_name', d.domain_name,
                        'shop_sector', ts.shop_sector,
                        'shop_sector_name', s.sector_name,
                        'shop_no', ts.shop_no,
                        'location', ts.location,
                        'created_at', ts.created_at
                    )

                /* 🟡 OTHER GROUPS → ONLY STATUS & ACTION */
                ELSE
                    json_build_object(
                        'id', ts.id,
                        'summary_group_id', ts.summary_group_id,
                        'summary_type', ts.summary_type,
                        'parent_summary_id', ts.parent_summary_id,
                        'status', ts.status,
                        'action', ts.action
                    )
            END
            ORDER BY ts.id
        ) AS summaries
    FROM admin.task_summaries ts
    LEFT JOIN public.domains d
        ON ts.shop_domain = d.domain_id
    LEFT JOIN public.sectors s
        ON ts.shop_sector = s.sector_id
    WHERE ts.task_report_id IN (
        SELECT id FROM filtered_reports
    )
)


  SELECT
      rt.*,
      COALESCE(tsl.summaries, '[]'::json) AS summaries
  FROM report_totals rt
  LEFT JOIN task_summary_list tsl ON TRUE;
      `,
      [task_id, task_reporting_date, access_token, summary_group_id]
    );

    if (staffReportResult.rows.length === 0) {
      return res.json({ message: "No data exists." });
    }

    res.json(staffReportResult.rows);
  } catch (err) {
    console.error("Error fetching staff report:", err);
    res.status(500).json({ error: "Failed to fetch staff report" });
  }
};

const get_marketing_staff_report_details_by_summary_id = async (req, res) => {
  try {
    const { summary_id } = req.params;

    if (!summary_id) {
      return res.status(400).json({ message: "Summary ID is required" });
    }

    // First, get the task_report_id from the summary
    const summaryResult = await ambarsariyaPool.query(
      `SELECT task_report_id FROM admin.task_summaries WHERE id = $1`,
      [summary_id]
    );

    if (summaryResult.rows.length === 0) {
      return res.status(404).json({ message: "Summary not found" });
    }

    const task_report_id = summaryResult.rows[0].task_report_id;

    // Get task_report_details
    const taskReportDetailsResult = await ambarsariyaPool.query(
      `SELECT * FROM admin.task_report_details WHERE id = $1`,
      [task_report_id]
    );

    if (taskReportDetailsResult.rows.length === 0) {
      return res.status(404).json({ message: "Task report details not found" });
    }

    const task_id = taskReportDetailsResult.rows[0].task_id;
    const task_reporting_date = taskReportDetailsResult.rows[0].task_reporting_date;

    // Get staff_tasks
    const staffTasksResult = await ambarsariyaPool.query(
      `SELECT * FROM admin.staff_tasks WHERE id = $1`,
      [task_id]
    );

    // Get all task_summaries for this task_report_id
    const taskSummariesResult = await ambarsariyaPool.query(
      `
      SELECT 
        ts.*,
        d.domain_name,
        s.sector_name
      FROM admin.task_summaries ts
      LEFT JOIN public.domains d ON ts.shop_domain = d.domain_id
      LEFT JOIN public.sectors s ON ts.shop_sector = s.sector_id
      WHERE ts.task_report_id = $1
      ORDER BY ts.id
      `,
      [task_report_id]
    );

    res.json({
      staff_task: staffTasksResult.rows[0] || null,
      task_report_details: taskReportDetailsResult.rows[0] || null,
      task_summaries: taskSummariesResult.rows || []
    });
  } catch (err) {
    console.error("Error fetching marketing staff report details:", err);
    res.status(500).json({ error: "Failed to fetch report details" });
  }
};

const put_replaceManagerAndDeleteEmployee = async (req, res) => {
  const { old_employee_id, assignments } = req.body;

  if (!old_employee_id || !Array.isArray(assignments)) {
    return res.status(400).json({ message: "Invalid payload" });
  }

  try {
    const query = `
      WITH update_staff AS (
        UPDATE admin.marketing_staff s
        SET manager_id = a.employee_id
        FROM jsonb_to_recordset($1::jsonb)
          AS a(staff_id INT, employee_id INT)
        WHERE s.id = a.staff_id
      ),
      update_tasks AS (
        UPDATE admin.staff_tasks st
        SET assigned_by = a.employee_id
        FROM jsonb_to_recordset($1::jsonb)
          AS a(staff_id INT, employee_id INT)
        WHERE st.assigned_to = a.staff_id
      ),
      employee_creds AS (
        SELECT credentials
        FROM admin.employees
        WHERE id = $2
      ),
      deleted_auth AS (
        DELETE FROM admin.auth_credentials
        WHERE id IN (SELECT credentials FROM employee_creds)
      )
      DELETE FROM admin.employees
      WHERE id = $2;
    `;

    await ambarsariyaPool.query(query, [
      JSON.stringify(assignments),
      old_employee_id,
    ]);

    res.status(200).json({
      message: "Employee processed successfully",
    });
  } catch (error) {
    console.error("Replace manager failed:", error);
    res.status(500).json({ message: "Operation failed" });
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
  create_staff_task,
  get_staff_tasks,
  get_staff_tasks_by_reporting_date,
  get_staff_task_with_token,
  create_or_update_task_report,
  get_staff_member_tasks,  
  get_grouped_staff_task_report_details,
  get_staff_task_report_details,
  get_all_staff_reports_by_token,
  get_selected_staff_task_report,
  get_marketing_staff_report_details_by_summary_id,
  put_replaceManagerAndDeleteEmployee,
  check_email_exists,
  get_staff_members_by_manager_id
};