const { createDbPool } = require("../db_config/db");
const ambarsariyaPool = createDbPool();
const twilio = require('twilio');
require('dotenv').config();

// Twilio configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID; // Twilio Verify Service SID

const client = twilio(accountSid, authToken);

// Helper function to format phone number for Twilio
const formatPhoneNumber = (phoneNumber) => {
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  if (!cleaned.startsWith('+91')) {
    if (cleaned.startsWith('91')) {
      cleaned = '+' + cleaned;
    } else if (cleaned.startsWith('0')) {
      cleaned = '+91' + cleaned.substring(1);
    } else {
      cleaned = '+91' + cleaned;
    }
  }
  
  if (cleaned.length === 13) {
    return cleaned;
  }
  
  return null;
};

// Extract last 10 digits from phone number
const extractPhoneDigits = (phoneNumber) => {
  const cleaned = phoneNumber.replace(/\D/g, '');
  return cleaned.slice(-10);
};

// Send phone OTP using Twilio Verify API
const sendPhoneOtp = async (req, res) => {
  const { phoneNumber, user_type } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ message: "Phone number is required" });
  }

  if (!verifyServiceSid) {
    return res.status(500).json({ message: "Twilio Verify Service not configured" });
  }

  const normalizedPhone = extractPhoneDigits(phoneNumber);

  try {
    // Check if user exists with this phone number
    const userQuery = `
      SELECT u.user_id, u.user_type,
             CASE 
               WHEN RIGHT(REGEXP_REPLACE(u.phone_no_1, '[^0-9]', '', 'g'), 10) = $1 THEN 'phone_1'
               WHEN RIGHT(REGEXP_REPLACE(u.phone_no_2, '[^0-9]', '', 'g'), 10) = $1 THEN 'phone_2'
             END AS phone_field
      FROM sell.users u
      WHERE RIGHT(REGEXP_REPLACE(u.phone_no_1, '[^0-9]', '', 'g'), 10) = $1
         OR RIGHT(REGEXP_REPLACE(u.phone_no_2, '[^0-9]', '', 'g'), 10) = $1
      LIMIT 1
    `;
    const userResult = await ambarsariyaPool.query(userQuery, [normalizedPhone]);

    let userId;
    let phoneField = 'phone_1'; // Default to phone_1 for members

    if (userResult.rowCount > 0) {
      userId = userResult.rows[0].user_id;
      phoneField = userResult.rows[0].phone_field || 'phone_1';
      
      // Get existing user_type or use provided one
      const existingUserType = userResult.rows[0].user_type || user_type || 'member';
      
      // Update user_type if needed
      if (userResult.rows[0].user_type !== existingUserType) {
        await ambarsariyaPool.query(
          `UPDATE sell.users SET user_type = $1 WHERE user_id = $2`,
          [existingUserType, userId]
        );
      }
    } else {
      // User doesn't exist yet (during registration)
      // Create a temporary users record with just phone number
      const registrationUserType = user_type || 'member';
      const insertResult = await ambarsariyaPool.query(
        `INSERT INTO sell.users (phone_no_1, user_type)
         VALUES ($1, $2)
         RETURNING user_id`,
        [phoneNumber, registrationUserType]
      );
      userId = insertResult.rows[0].user_id;
    }

    // Format phone number for Twilio
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    if (!formattedPhone) {
      return res.status(400).json({ message: "Invalid phone number format" });
    }

    // Send OTP via Twilio Verify API
    try {
      const verification = await client.verify.v2
        .services(verifyServiceSid)
        .verifications
        .create({
          to: formattedPhone,
          channel: 'sms'
        });
      
      console.log("Phone OTP sent successfully via Twilio Verify. SID:", verification.sid);
      
      res.status(200).json({
        success: true,
        message: "OTP sent successfully to phone",
        user_id: userId,
        verification_sid: verification.sid,
      });
    } catch (twilioError) {
      console.error('Error sending OTP via Twilio Verify:', twilioError);
      
      if (twilioError.code === 21211) {
        return res.status(400).json({ message: "Invalid phone number format" });
      } else if (twilioError.code === 21608) {
        return res.status(400).json({ message: "Phone number is not verified. Please verify your number in Twilio console." });
      } else {
        return res.status(500).json({ 
          message: twilioError.message || 'Error sending OTP SMS. Please try again later.' 
        });
      }
    }
  } catch (error) {
    console.error('Error in sendPhoneOtp:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Verify phone OTP using Twilio Verify API
const verifyPhoneOtp = async (req, res) => {
  const { phoneNumber, phone_otp } = req.body;

  if (!phoneNumber || !phone_otp) {
    return res.status(400).json({ message: "Phone number and OTP are required" });
  }

  if (!verifyServiceSid) {
    return res.status(500).json({ message: "Twilio Verify Service not configured" });
  }

  const normalizedPhone = extractPhoneDigits(phoneNumber);

  try {
    // Find user by phone number
    const result = await ambarsariyaPool.query(
      `SELECT u.user_id
       FROM sell.users u
       WHERE RIGHT(REGEXP_REPLACE(u.phone_no_1, '[^0-9]', '', 'g'), 10) = $1
          OR RIGHT(REGEXP_REPLACE(u.phone_no_2, '[^0-9]', '', 'g'), 10) = $1
       LIMIT 1`,
      [normalizedPhone]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Phone number not found" });
    }

    const userId = result.rows[0].user_id;

    // Format phone number for Twilio
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    if (!formattedPhone) {
      return res.status(400).json({ message: "Invalid phone number format" });
    }

    // Verify OTP using Twilio Verify API
    try {
      const verificationCheck = await client.verify.v2
        .services(verifyServiceSid)
        .verificationChecks
        .create({
          to: formattedPhone,
          code: phone_otp
        });

      if (verificationCheck.status === 'approved') {
        res.json({
          success: true,
          message: "Phone OTP verified successfully",
          user_id: userId,
        });
      } else {
        res.status(400).json({ 
          message: verificationCheck.status === 'pending' 
            ? "Invalid OTP. Please try again." 
            : "OTP verification failed. Please request a new OTP."
        });
      }
    } catch (twilioError) {
      console.error('Error verifying OTP via Twilio:', twilioError);
      
      if (twilioError.code === 20404) {
        return res.status(400).json({ message: "No verification found. Please request a new OTP." });
      } else if (twilioError.code === 20403) {
        return res.status(400).json({ message: "Invalid or expired OTP. Please request a new OTP." });
      } else {
        return res.status(500).json({ 
          message: twilioError.message || "OTP verification failed. Please try again." 
        });
      }
    }
  } catch (err) {
    console.error('Error in verifyPhoneOtp:', err);
    res.status(500).json({ message: "OTP verification failed" });
  }
};

module.exports = {
  sendPhoneOtp,
  verifyPhoneOtp,
};
