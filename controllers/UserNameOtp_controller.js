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

const sendOTP = async (req, res) => {
    try {
      const { username, context } = req.body;
      if (!username) {
        return res.status(400).json({ message: "Username is required" });
      }
      
      console.log("Sending OTP to:", username);
  
      // Generate OTP
      const otp = generateOTP();
  
      // Send OTP via email
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: username,
        subject: 'Your OTP Code',
        text: `Your OTP is: ${otp}. It is valid for the next 5 minutes.`,
      };
  
      await transporter.sendMail(mailOptions);
  
      // Respond with a success message
      res.status(200).json({ message: "OTP sent successfully" , otp:otp});
  
    } catch (emailError) {
      console.error('Error sending OTP email:', emailError);
      res.status(500).json({ message: 'Error sending OTP email. Please try again later.' });
    }
  };
  

module.exports = { sendOTP };
