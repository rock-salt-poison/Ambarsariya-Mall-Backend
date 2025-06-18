const { createDbPool } = require('../db_config/db');
const ambarsariyaPool = createDbPool();
const nodemailer = require('nodemailer');
require('dotenv').config();

// SMTP setup
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER, // SMTP username
    pass: process.env.SMTP_PASS, // SMTP password
  },
});

// Helper function to generate a 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Function to send OTP
const sendOTP = async (req, res) => {
  const { username, context } = req.body; // Assuming `context` is passed in the request body

  try {
    // Set allowed user types based on the context
    let allowedUserTypes = [];
    if (context === "sell") {
      allowedUserTypes = ["shop", "merchant"];
    } else if (context === "buy") {
      allowedUserTypes = ["member", "visitor"];
    } else {
      return res.status(400).json({ message: "Invalid context provided." });
    }

    // Check if user exists with the correct context (user type)
    const userQuery = `
      SELECT * FROM sell.user_credentials
      WHERE username = $1
      AND user_id IN (
        SELECT user_id FROM sell.users WHERE user_type = ANY($2::text[])
      )
    `;
    const userResult = await ambarsariyaPool.query(userQuery, [username, allowedUserTypes]);

    if (userResult.rows.length === 0) {
      return res.json({ message: 'Username not found for the specified context' });
    }

    const user = userResult.rows[0];
    const email = user.username;  // Assuming username is the email
    const access_token = user.access_token;

    // Generate OTP
    const otp = generateOTP();

    // Set OTP expiration time (e.g., 5 minutes from now)
    const otpExpiryTime = new Date();
    otpExpiryTime.setMinutes(otpExpiryTime.getMinutes() + 5);

    // Store OTP and its expiration time in the database
    const otpQuery = `
      UPDATE sell.user_credentials
      SET otp = $1, otp_created_at = NOW(), otp_expiry_at = $2
      WHERE access_token = $3
    `;
    await ambarsariyaPool.query(otpQuery, [otp, otpExpiryTime, access_token]);

    // Send OTP via email
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP is: ${otp}. It is valid for the next 5 minutes.`,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error('Error sending OTP email:', emailError);
      return res.status(500).json({ message: 'Error sending OTP email. Please try again later.' });
    }

    // Send success response
    res.status(200).json({ message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { sendOTP };
