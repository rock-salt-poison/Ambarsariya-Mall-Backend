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
      FROM admin.staff s
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
      SELECT st.*
      FROM admin.staff_tasks st
      JOIN admin.staff s 
        ON s.id = st.assigned_to
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
       FROM admin.staff s
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

const create_task_report = async (req, res) => {
  try {
    console.log(req.body);
    
    const { formData, clientSummaries } = req.body;

    // 1️⃣ Insert task_report_details
    const taskReportQuery = `
      INSERT INTO admin.task_report_details (
        task_id,
        task_reporting_date,
        visits,
        joined,
        in_pipeline,
        total_leads,
        daily_leads,
        total_capture,
        daily_capture,
        lead_suggestions,
        lead_suggestions_after_confirmation,
        total_confirmation,
        daily_confirmation
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id
    `;

    const taskReportValues = [
      formData.task_id,
      formData.task_reporting_date,
      formData.visits || 0,
      formData.joined || 0,
      formData.in_pipeline || 0,
      formData.total_leads || 0,
      formData.daily_leads || 0,
      formData.total_capture || 0,
      formData.daily_capture || 0,
      formData.lead_suggestions || '',
      formData.lead_suggestions_after_confirmation || '',
      formData.total_confirmation || 0,
      formData.Daily_confirmation || 0
    ];

    const { rows } = await ambarsariyaPool.query(taskReportQuery, taskReportValues);
    const task_report_id = rows[0].id;

    // 2️⃣ Insert clientSummaries
    let summary_group_counter = 1;

    for (const group of clientSummaries) {
      const group_id = summary_group_counter++;
      let parent_id_map = {};

      for (const stage of group.stages) {
        let parent_summary_id = null;
        if (stage.type === 'Lead Summary') parent_summary_id = parent_id_map['Client Summary'];
        else if (stage.type === 'Capture Summary') parent_summary_id = parent_id_map['Lead Summary'];

        const stageData = stage.data || {};

        const insertStageQuery = `
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
            lead_select,
            shop_no,
            location
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
          RETURNING id
        `;

        const stageValues = [
          task_report_id,
          group_id,
          parent_summary_id,
          stage.type.replace(' Summary','').toUpperCase(),
          stage.status,
          stageData.name || '',
          stageData.phone || '',
          stageData.email || '',
          stageData.shop || '',
          stageData.domain || '',
          stageData.sector || '',
          stageData.lead_select || '',
          stageData.shop_no || '',
          stageData.location 
        ];

        const { rows: stageRows } = await ambarsariyaPool.query(insertStageQuery, stageValues);
        parent_id_map[stage.type] = stageRows[0].id;
      }
    }

    res.status(201).json({ success: true, task_report_id });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
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
  get_staff_task_with_token,
  create_task_report
};
