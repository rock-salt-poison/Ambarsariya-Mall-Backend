const { createDbPool } = require("../db_config/db");
const ambarsariyaPool = createDbPool();
const nodemailer = require('nodemailer');
require('dotenv').config();

// SMTP setup
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Helper function to generate a 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Send email OTP and store in user_credentials table
const sendEmailOtp = async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ message: "Username is required" });
  }

  const normalizedUsername = username.trim().toLowerCase();
  const otp = generateOTP();

  try {
    // Check if user_credentials exists for this username
    // Check if OTP was sent recently (within 5 minutes) using SQL
    const existingQuery = `
      SELECT uc.id, uc.user_id
      FROM sell.user_credentials uc
      WHERE uc.username = $1
        AND uc.otp_created_at IS NOT NULL
        AND uc.otp_created_at > NOW() - INTERVAL '5 minutes'
    `;
    const existing = await ambarsariyaPool.query(existingQuery, [normalizedUsername]);

    let credentialsId;

    if (existing.rowCount > 0) {
      const row = existing.rows[0];
      
      // OTP was sent recently (within 5 minutes)
      return res.status(200).json({
        success: true,
        message: "OTP already sent. Please check your email.",
        credentials_id: row.id,
      });
    }
    
    // Check if record exists (even if OTP expired)
    const recordCheck = await ambarsariyaPool.query(
      `SELECT id, user_id FROM sell.user_credentials WHERE username = $1`,
      [normalizedUsername]
    );
    
    if (recordCheck.rowCount > 0) {
      credentialsId = recordCheck.rows[0].id;

      // Update existing record with new OTP
      // Use SQL to calculate expiry time to ensure timezone consistency
      await ambarsariyaPool.query(
        `UPDATE sell.user_credentials
         SET otp = $1, otp_created_at = NOW(), otp_expiry_at = NOW() + INTERVAL '5 minutes'
         WHERE username = $2`,
        [otp, normalizedUsername]
      );
      credentialsId = row.id;
    } else {
      // Create new user_credentials record (user_id will be set later during registration)
      // Use SQL to calculate expiry time to ensure timezone consistency
      const insertResult = await ambarsariyaPool.query(
        `INSERT INTO sell.user_credentials (username, otp, otp_created_at, otp_expiry_at)
         VALUES ($1, $2, NOW(), NOW() + INTERVAL '5 minutes')
         RETURNING id`,
        [normalizedUsername, otp]
      );
      credentialsId = insertResult.rows[0].id;
    }

    // Send OTP via email
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: normalizedUsername,
      subject: 'Your OTP Code',
      text: `Your OTP is: ${otp}. It is valid for the next 5 minutes.`,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error('Error sending OTP email:', emailError);
      return res.status(500).json({ message: 'Error sending OTP email. Please try again later.' });
    }

    res.status(200).json({
      success: true,
      message: "OTP sent successfully to email",
      credentials_id: credentialsId,
    });
  } catch (error) {
    console.error('Error in sendEmailOtp:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Verify email OTP
const verifyEmailOtp = async (req, res) => {
  const { username, email_otp } = req.body;
  const normalizedUsername = username.trim().toLowerCase();

  if (!username || !email_otp) {
    return res.status(400).json({ message: "Username and OTP are required" });
  }

  try {
    // Verify OTP and check expiration using SQL
    // Since columns are timestamp without timezone, compare directly in SQL
    const result = await ambarsariyaPool.query(
      `SELECT id, otp
       FROM sell.user_credentials
       WHERE username = $1
         AND otp IS NOT NULL
         AND otp_expiry_at > NOW()`,
      [normalizedUsername]
    );

    if (result.rowCount === 0) {
      // Check if username exists but OTP is missing or expired
      const checkExists = await ambarsariyaPool.query(
        `SELECT id FROM sell.user_credentials WHERE username = $1`,
        [normalizedUsername]
      );
      
      if (checkExists.rowCount === 0) {
        return res.status(404).json({ message: "Username not found" });
      } else {
        return res.status(400).json({ message: "No OTP found or OTP expired. Please request a new OTP." });
      }
    }

    const row = result.rows[0];

    // Verify OTP
    if (row.otp !== email_otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Mark as verified (clear OTP after successful verification)
    await ambarsariyaPool.query(
      `UPDATE sell.user_credentials
       SET otp = NULL, otp_created_at = NULL, otp_expiry_at = NULL
       WHERE username = $1`,
      [normalizedUsername]
    );

    res.json({
      success: true,
      message: "Email OTP verified successfully",
      credentials_id: row.id,
    });
  } catch (err) {
    console.error('Error in verifyEmailOtp:', err);
    res.status(500).json({ message: "OTP verification failed" });
  }
};

module.exports = {
  sendEmailOtp,
  verifyEmailOtp,
};
