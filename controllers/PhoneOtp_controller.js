const twilio = require('twilio');
require('dotenv').config();

// Twilio configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID ;
const authToken = process.env.TWILIO_AUTH_TOKEN ;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER ;

const client = twilio(accountSid, authToken);

// Helper function to generate a 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Helper function to format phone number for Twilio
// Converts "+91 XXXXX-XXXXX" to "+91XXXXXXXXXX"
const formatPhoneNumber = (phoneNumber) => {
  // Remove all non-digit characters except the leading +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Ensure it starts with +91
  if (!cleaned.startsWith('+91')) {
    // If it starts with 91, add +
    if (cleaned.startsWith('91')) {
      cleaned = '+' + cleaned;
    } else if (cleaned.startsWith('0')) {
      // If it starts with 0, replace with +91
      cleaned = '+91' + cleaned.substring(1);
    } else {
      // Otherwise, add +91
      cleaned = '+91' + cleaned;
    }
  }
  
  // Ensure it's exactly 13 characters (+91 + 10 digits)
  if (cleaned.length === 13) {
    return cleaned;
  }
  
  return null;
};

const sendOTP = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }
    
    console.log("Sending OTP to phone:", phoneNumber);
    
    // Format phone number for Twilio
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    if (!formattedPhone) {
      return res.status(400).json({ message: "Invalid phone number format" });
    }
    
    // Generate OTP
    const otp = generateOTP();
    
    // Send OTP via Twilio SMS
    try {
      const message = await client.messages.create({
        body: `Your OTP is: ${otp}. It is valid for the next 5 minutes.`,
        from: twilioPhoneNumber,
        to: formattedPhone
      });
      
      console.log("OTP sent successfully. Message SID:", message.sid);
      console.log("OTP:", otp);
      
      // Respond with a success message
      res.status(200).json({ 
        message: "OTP sent successfully", 
        otp: otp,
        messageSid: message.sid
      });
      
    } catch (twilioError) {
      console.error('Error sending OTP via Twilio:', twilioError);
      
      // Handle specific Twilio errors
      if (twilioError.code === 21211) {
        return res.status(400).json({ message: "Invalid phone number format" });
      } else if (twilioError.code === 21608) {
        return res.status(400).json({ message: "Phone number is not verified. Please verify your number in Twilio console." });
      } else {
        return res.status(500).json({ message: 'Error sending OTP SMS. Please try again later.' });
      }
    }
    
  } catch (error) {
    console.error('Error in sendOTP:', error);
    res.status(500).json({ message: 'Internal server error. Please try again later.' });
  }
};

module.exports = { sendOTP };
