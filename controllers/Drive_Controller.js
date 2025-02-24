const { google } = require("googleapis");
const { processDrive } = require("./GoogleDriveAccess/Drive");
const { oAuth2Client } = require("./GoogleDriveAccess/GoogleAuth");
const { createDbPool } = require("../db_config/db");
const ambarsariyaPool = createDbPool();

/**
 * 1️⃣ Open Google Drive File (Check and Refresh Token if Needed)
 */
const post_openFile = async (req, res) => {
  const { email } = req.params;

  try {
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    // 🔍 Fetch OAuth tokens using JOIN on user_id
    const result = await ambarsariyaPool.query(
      `SELECT ef.oauth_access_token, ef.oauth_refresh_token, ef.user_id
      FROM sell.eshop_form ef
      JOIN sell.user_credentials uc 
      ON ef.user_id = uc.user_id
      WHERE uc.username = $1`,
      [email]
    );

    if (!result.rows.length) return res.status(401).json({ success: false, message: "User not authenticated" });

    let { oauth_access_token, oauth_refresh_token, user_id } = result.rows[0];

    // 🔄 Refresh Token if Access Token is Expired
    if (!oauth_access_token) {
      if (!oauth_refresh_token) {
        return res.status(403).json({ success: false, message: "Re-authentication required" });
      }

      try {
        const { credentials } = await oAuth2Client.refreshToken(oauth_refresh_token);
        oauth_access_token = credentials.access_token;

        // ✅ Check if a new refresh token is provided, update both tokens if needed
        if (credentials.refresh_token) {
          oauth_refresh_token = credentials.refresh_token;

          await ambarsariyaPool.query(
            `UPDATE sell.eshop_form 
            SET oauth_access_token = $1, oauth_refresh_token = $2 
            WHERE user_id = $3`,
            [oauth_access_token, oauth_refresh_token, user_id]
          );
        } else {
          await ambarsariyaPool.query(
            `UPDATE sell.eshop_form 
            SET oauth_access_token = $1 
            WHERE user_id = $2`,
            [oauth_access_token, user_id]
          );
        }
      } catch (refreshError) {
        console.error("Failed to refresh token:", refreshError.message);
        return res.status(403).json({ success: false, message: "Re-authentication required" });
      }
    }

    const response = await processDrive(email, oauth_access_token);
    return res.json(response);
  } catch (e) {
    console.error("Error opening file:", e);
    return res.status(500).json({ success: false, message: "Error opening file" });
  }
};


/**
 * 2️⃣ Check if User Has Granted Drive Access
 */
const get_checkDriveAccess = async (req, res) => {
  const { email } = req.params;

  try {
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const result = await ambarsariyaPool.query(
      `SELECT ef.oauth_access_token
      FROM sell.eshop_form ef
      JOIN sell.user_credentials uc 
      ON ef.user_id = uc.user_id
      WHERE uc.username = $1`,
      [email]
    );

    if (result.rows.length && result.rows[0].oauth_access_token) {
      return res.json({ accessGranted: true });
    } else {
      return res.json({ accessGranted: false });
    }
  } catch (e) {
    console.error("Error checking access:", e.message);
    return res.status(500).json({ success: false, message: "Error checking access" });
  }
};

/**
 * 3️ Request Google Drive Access
 */
const get_requestDriveAccess = (req, res) => {
  const url = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/userinfo.email",],
    prompt: "consent",
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
  });

  res.redirect(url);
};

/**
 * 4️ Handle OAuth Callback and Store Tokens in Database
 */
const get_handleAuthCallback = async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    console.log("OAuth Tokens Received:", tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ auth: oAuth2Client, version: "v2" });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;

    // Fetch shop_access_token using email
    const shopResult = await ambarsariyaPool.query(
      `SELECT ef.shop_access_token 
      FROM sell.eshop_form ef
      JOIN sell.user_credentials uc 
      ON ef.user_id = uc.user_id
      WHERE uc.username = $1`,
      [email]
    );

    if (!shopResult.rows.length) {
      return res.status(404).json({ success: false, message: "Shop not found" });
    }

    const shop_access_token = shopResult.rows[0].shop_access_token;

    // Store Access & Refresh Tokens in DB using shop_access_token
    await ambarsariyaPool.query(
      `UPDATE sell.eshop_form 
      SET oauth_access_token = $1, oauth_refresh_token = $2 
      WHERE shop_access_token = $3`,
      [tokens.access_token, tokens.refresh_token, shop_access_token]
    );

    // **Dynamically Construct Frontend Redirect URL**
    const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || "http://localhost:3000";
    const redirectUrl = `${FRONTEND_BASE_URL}/AmbarsariyaMall/sell/support/shop/${shop_access_token}/dashboard/edit?email=${email}`;

    console.log("Redirecting to:", redirectUrl);
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error("OAuth Error:", error.message);
    res.status(500).send("Authentication failed.");
  }
};


module.exports = {
  post_openFile,
  get_checkDriveAccess,
  get_requestDriveAccess,
  get_handleAuthCallback,
};
