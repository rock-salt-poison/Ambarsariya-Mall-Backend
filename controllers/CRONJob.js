const cron = require('node-cron');
const { createDbPool } = require("../db_config/db");
const ambarsariyaPool = createDbPool();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const checkAndNotify = async () => {
    try {
      const { rows: pendingVisitors } = await ambarsariyaPool.query(
        `SELECT s.*
FROM sell.support s
JOIN sell.eshop_form ef
  ON ef.domain = s.domain_id
  AND ef.sector = s.sector_id
WHERE s.purpose ILIKE 'buy'
  AND s.created_at <= NOW() - INTERVAL '59 minutes'
  AND s.response IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sell.support_chat_notifications scn
    WHERE scn.domain_id = s.domain_id
      AND scn.sector_id = s.sector_id
      AND scn.visitor_id = s.visitor_id
      AND scn.shop_id = ef.shop_no  -- Join condition here with shop_no from eshop_form
      AND scn.message = s.message
  );`
      );
      console.log('pendingVisitors', pendingVisitors);
      
      for (const visitor of pendingVisitors) {
        const { visitor_id, domain_id, sector_id, name, phone_no, message, access_token, file_attached, purpose } = visitor;
  
        // Get merchants with same domain but different sector
        const { rows: merchants } = await ambarsariyaPool.query(
          `SELECT ef.shop_no, uc.username, uc.user_id
           FROM sell.eshop_form ef 
           JOIN sell.user_credentials uc ON uc.user_id = ef.user_id
           WHERE ef.domain = $1 AND ef.sector != $2 AND uc.access_token != $3`,
          [domain_id, sector_id, access_token]
        );
        console.log('merchants : ', merchants);
        
        for (const merchant of merchants) {
          const fileLink = file_attached
            ? `You can view the file here: ${file_attached}`
            : 'No file attached';
  
          const mailOptions = {
            from: process.env.SMTP_USER,
            to: merchant.username,
            subject: 'Follow-up: Buyer Inquiry Awaiting Response',
            text: `Hello ${merchant.username},
  
A new user has shown interest in buying something from your store.
  
  Details:
  - Name: ${name}
  - Phone No: ${phone_no}
  - Purpose: ${purpose}
  - Message: ${message}
  - File: ${fileLink}
  
  Consider reaching out:
  https://ambarsariya-emall-frontend.vercel.app/AmbarsariyaMall/sell/support
  
  Regards,
  Ambarsariya Mall Support`,
          };
  
          try {
            await transporter.sendMail(mailOptions);
            console.log(`Delayed fallback email sent to ${merchant.username}`);
  
            await ambarsariyaPool.query(
              `INSERT INTO sell.support_chat_notifications 
               (domain_id, sector_id, visitor_id, shop_id, purpose, message, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')`,
              [domain_id, sector_id, visitor_id, merchant.shop_no, 'buy', message]
            );
          } catch (err) {
            console.error(`Error sending delayed email to ${merchant.username}:`, err);
          }
        }
      }
    } catch (err) {
      console.error("Cron job error (delayed visitor notification):", err);
    }
  };
  

// Schedule every 5 minutes
cron.schedule('*/1 * * * *', checkAndNotify);

module.exports = cron;
