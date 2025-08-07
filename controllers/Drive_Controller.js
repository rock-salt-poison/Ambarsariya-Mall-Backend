const { google } = require("googleapis");
const { processDrive, createItemCsv, createSKUCsv, createRKUCsv } = require("./GoogleDriveAccess/Drive");
const { oAuth2Client, driveService, sheetsService } = require("./GoogleDriveAccess/GoogleAuth");
const { createDbPool } = require("../db_config/db");
const { default: axios } = require("axios");
const dayjs = require("dayjs");
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const ambarsariyaPool = createDbPool();
require("dotenv").config();

dayjs.extend(utc);
dayjs.extend(timezone);

const serviceScopeMapping = {
  contacts: 'https://www.googleapis.com/auth/contacts.readonly',
  maps: 'https://www.googleapis.com/auth/mapsengine',
  calendar: 'https://www.googleapis.com/auth/calendar',
  meet: 'https://www.googleapis.com/auth/meetings.space.created',
  photos: 'https://www.googleapis.com/auth/photoslibrary.readonly',
  chat: 'https://www.googleapis.com/auth/chat.messages',
  profile: 'https://www.googleapis.com/auth/userinfo.profile',
  email: 'https://www.googleapis.com/auth/userinfo.email',
};


/**
 * 1️⃣ Open Google Drive File (Check and Refresh Token if Needed)
 */
const post_openFile = async (req, res) => {
  const { email } = req.params;
  const channel = `drive-channel-${email}`;  // A unique channel per user, for example
  
  try {
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });

    // 🔍 Fetch OAuth tokens using JOIN on user_id
    const result = await ambarsariyaPool.query(
      `SELECT ef.oauth_access_token, ef.oauth_refresh_token, ef.user_id
      FROM sell.eshop_form ef
      JOIN sell.user_credentials uc 
      ON ef.user_id = uc.user_id
      WHERE uc.username = $1`,
      [email]
    );

    if (!result.rows.length)
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated" });

    let { oauth_access_token, oauth_refresh_token, user_id } = result.rows[0];

    // 🔄 Refresh Token if Access Token is Expired
    if (!oauth_access_token) {
      if (!oauth_refresh_token) {
        return res
          .status(403)
          .json({ success: false, message: "Re-authentication required" });
      }

      try {
        const { credentials } = await oAuth2Client.refreshToken(
          oauth_refresh_token
        );
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
        return res
          .status(403)
          .json({ success: false, message: "Re-authentication required" });
      }
    }

    const response = await processDrive(email, user_id);
    return res.json(response);
  } catch (e) {
    console.error("Error opening file:", e);
    return res
      .status(500)
      .json({ success: false, message: "Error opening file" });
  }
};

const post_openItemsCSVFile = async (req, res) => {
  const { email, shop_no } = req.params;
  const rackData = req.body;
  try {
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });

    // 🔍 Fetch OAuth tokens using JOIN on user_id
    const result = await ambarsariyaPool.query(
      `SELECT ef.oauth_access_token, ef.oauth_refresh_token, ef.user_id
      FROM sell.eshop_form ef
      JOIN sell.user_credentials uc 
      ON ef.user_id = uc.user_id
      WHERE uc.username = $1`,
      [email]
    );

    if (!result.rows.length)
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated" });

    let { oauth_access_token, oauth_refresh_token, user_id } = result.rows[0];

    // 🔄 Refresh Token if Access Token is Expired
    if (!oauth_access_token) {
      if (!oauth_refresh_token) {
        return res
          .status(403)
          .json({ success: false, message: "Re-authentication required" });
      }

      try {
        const { credentials } = await oAuth2Client.refreshToken(
          oauth_refresh_token
        );
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
        return res
          .status(403)
          .json({ success: false, message: "Re-authentication required" });
      }
    }

    const response = await createItemCsv(email, shop_no, rackData, user_id);
    return res.json(response);
  } catch (e) {
    console.error("Error opening items file:", e);
    return res
      .status(500)
      .json({ success: false, message: "Error opening items file" });
  }
};

const post_openSKUCSVFile = async (req, res) => {
  const { email, shop_no } = req.params;
  const rackWallData = req.body;
  try {
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });

    // 🔍 Fetch OAuth tokens using JOIN on user_id
    const result = await ambarsariyaPool.query(
      `SELECT ef.oauth_access_token, ef.oauth_refresh_token, ef.user_id
      FROM sell.eshop_form ef
      JOIN sell.user_credentials uc 
      ON ef.user_id = uc.user_id
      WHERE uc.username = $1`,
      [email]
    );

    if (!result.rows.length)
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated" });

    let { oauth_access_token, oauth_refresh_token, user_id } = result.rows[0];

    // 🔄 Refresh Token if Access Token is Expired
    if (!oauth_access_token) {
      if (!oauth_refresh_token) {
        return res
          .status(403)
          .json({ success: false, message: "Re-authentication required" });
      }

      try {
        const { credentials } = await oAuth2Client.refreshToken(
          oauth_refresh_token
        );
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
        return res
          .status(403)
          .json({ success: false, message: "Re-authentication required" });
      }
    }

    const response = await createSKUCsv(email, shop_no, rackWallData, user_id);
    return res.json(response);
  } catch (e) {
    console.error("Error opening sku file:", e);
    return res
      .status(500)
      .json({ success: false, message: "Error opening sku file" });
  }
};

const post_openRKUCSVFile = async (req, res) => {
  const { email, shop_no } = req.params;

  try {
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });

    // 🔍 Fetch OAuth tokens using JOIN on user_id
    const result = await ambarsariyaPool.query(
      `SELECT ef.oauth_access_token, ef.oauth_refresh_token, ef.user_id
      FROM sell.eshop_form ef
      JOIN sell.user_credentials uc 
      ON ef.user_id = uc.user_id
      WHERE uc.username = $1`,
      [email]
    );

    if (!result.rows.length)
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated" });

    let { oauth_access_token, oauth_refresh_token, user_id } = result.rows[0];

    // 🔄 Refresh Token if Access Token is Expired
    if (!oauth_access_token) {
      if (!oauth_refresh_token) {
        return res
          .status(403)
          .json({ success: false, message: "Re-authentication required" });
      }

      try {
        const { credentials } = await oAuth2Client.refreshToken(
          oauth_refresh_token
        );
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
        return res
          .status(403)
          .json({ success: false, message: "Re-authentication required" });
      }
    }

    const response = await createRKUCsv(email, shop_no, user_id);
    return res.json(response);
  } catch (e) {
    console.error("Error opening rku file:", e);
    return res
      .status(500)
      .json({ success: false, message: "Error opening rku file" });
  }
};

/**
 * 2️⃣ Check if User Has Granted Drive Access
 */
const get_checkDriveAccess = async (req, res) => {
  const { email } = req.params;

  try {
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });

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
    return res
      .status(500)
      .json({ success: false, message: "Error checking access" });
  }
};

const get_checkGoogleAccess = async (req, res) => {
  const { email } = req.params;
  console.log(email);
  
  try {
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });

    const result = await ambarsariyaPool.query(
      `SELECT mp.oauth_access_token
      FROM sell.member_profiles mp
      JOIN sell.user_credentials uc 
      ON mp.user_id = uc.user_id
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
    return res
      .status(500)
      .json({ success: false, message: "Error checking access" });
  }
};

/**
 * Request Google Drive Access
 */
const get_requestDriveAccess = (req, res) => {
  const url = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    prompt: "consent",
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
  });

  res.redirect(url);
};


const get_requestGoogleAccess = (req, res) => {
  const { username } = req.params;
  const { redirect_url } = req.query; 
  console.log(username);
  
  if (!username) {
    return res.status(400).json({ success: false, message: "Username is required" });
  }

  const scopes = [
    "https://www.googleapis.com/auth/userinfo.email",
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/mapsengine',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/meetings.space.created',
    'https://www.googleapis.com/auth/photoslibrary.readonly',
    'https://www.googleapis.com/auth/userinfo.profile',
    // "https://www.googleapis.com/auth/chat.messages.readonly",
    // "https://www.googleapis.com/auth/chat.spaces.readonly",
    "https://www.googleapis.com/auth/chat.messages"
  ];

  const redirectUri = process.env.GOOGLE_REDIRECT_URI2;

  const url = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
    login_hint: username,
    redirect_uri: redirectUri,
    state: encodeURIComponent(redirect_url || '')
  });

  res.redirect(url);
};

const post_requestDynamicGoogleAccess = (req, res) => {
  const { username, services } = req.body;

  console.log('Services : ', services);
  
  
  if (!username || !services || !Array.isArray(services)) {
    return res.status(400).json({ success: false, message: "Username and services are required" });
  }

  // Always include email access
  const selectedScopes = [serviceScopeMapping.email];

  services.forEach(service => {
    if (serviceScopeMapping[service]) {
      selectedScopes.push(serviceScopeMapping[service]);
    }
  });

  const url = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: selectedScopes,
    prompt: "consent",
    login_hint: username,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI2,
  });

  res.json({ success: true, authUrl: url });
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
      return res
        .json({ success: false, message: "Shop not found" });
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
    const FRONTEND_BASE_URL =
      process.env.FRONTEND_BASE_URL || "http://localhost:3002";
    const redirectUrl = `${FRONTEND_BASE_URL}/sell/support/shop/${shop_access_token}/dashboard/edit?email=${email}`;

    console.log("Redirecting to:", redirectUrl);
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error("OAuth Error:", error.message);
    res.status(500).send("Authentication failed.");
  }
};

const handleAuthCallback2 = async (req, res) => {
  const code = req.query.code;
  const state = req.query.state; // ← comes from the state parameter in step 1
  const dynamicRedirect = decodeURIComponent(state || '');

  if (!code) {
    return res.status(400).json({ success: false, message: "Authorization code missing" });
  }

  try {
    // Get tokens from the authorization code
    const { tokens } = await oAuth2Client.getToken({
      code,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI2,
    });
    oAuth2Client.setCredentials(tokens);

    console.log("OAuth Tokens Received:", tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ auth: oAuth2Client, version: 'v2' });
    const { data } = await oauth2.userinfo.get();
    const email = data.email;
    console.log(`Google account used: ${email}`);

    const memberResult = await ambarsariyaPool.query(
      `SELECT mp.member_id 
       FROM sell.member_profiles mp
       JOIN sell.user_credentials uc 
       ON mp.user_id = uc.user_id
       WHERE uc.username = $1`,
      [email]
    );

    if (!memberResult.rows.length) {
      return res.json({ success: false, message: "Member not found" });
    }

    const member_id = memberResult.rows[0].member_id;

    // Save access token into DB
    await ambarsariyaPool.query(
      `UPDATE sell.member_profiles
       SET 
         oauth_access_token = $1,
         oauth_refresh_token = $2
       WHERE member_id = $3;`,
      [tokens.access_token, tokens.refresh_token, member_id]
    );

    const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || "http://localhost:3002";
    const finalRedirectUrl = dynamicRedirect || `${FRONTEND_BASE_URL}/sell/esale`;

    console.log("Redirecting to:", finalRedirectUrl);
    return res.redirect(finalRedirectUrl);
  } catch (err) {
    console.error("OAuth callback2 error:", err.message);
    return res.status(500).json({ success: false, message: "OAuth callback failed" });
  }
};


const get_imageLink = async (req, res) => {
  try {
    const fileId = req.params.fileId;

    // Get file metadata to determine MIME type
    const fileMeta = await driveService.files.get({
      fileId,
      fields: "name, mimeType",
    });

    // Fetch actual file content
    const response = await driveService.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );

    // Set the correct Content-Type
    res.setHeader("Content-Type", fileMeta.data.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${fileMeta.data.name}"`
    );

    // Stream the file response
    response.data.pipe(res);
  } catch (error) {
    console.error("Error fetching file:", error.message);
    res.status(500).send("Failed to fetch file");
  }
};

const get_sheetsData = async (req, res) => {
  try {
    const spreadsheetId = req.params.sheetId;

    // Fetch metadata of all sheet tabs
    const metadataResponse = await sheetsService.spreadsheets.get({ spreadsheetId });

    // Extract all sheet names (tabs)
    const sheetTabs = metadataResponse.data.sheets.map(sheet => sheet.properties.title);

    // Fetch data dynamically for each sheet without a fixed range
    const sheetDataPromises = sheetTabs.map(async (sheetName) => {
      const dataResponse = await sheetsService.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}`, // No fixed range (fetches all data)
      });

      return { sheetName, data: dataResponse.data.values || [] };
    });

    // Wait for all sheet data to be fetched
    const allSheetData = await Promise.all(sheetDataPromises);

    res.json({ success: true, sheets: allSheetData });
  } catch (error) {
    console.error("❌ Error fetching sheet data:", error);
    res.status(500).json({ success: false, message: "Failed to fetch sheet data" });
  }
};


const getUserOAuthTokens = async (member_id, user_id) => {
  const result = await ambarsariyaPool.query(
    `SELECT mp.oauth_access_token, mp.oauth_refresh_token
     FROM sell.member_profiles mp
     WHERE mp.member_id = $1 AND mp.user_id = $2`,
    [member_id, user_id]
  );

  if (result.rows.length === 0) throw new Error('User tokens not found');
  return result.rows[0];
};


const getGoogleContacts = async (req, res) => {
  const { member_id, user_id } = req.params;

  try {
    const { oauth_access_token, oauth_refresh_token } = await getUserOAuthTokens(member_id, user_id);

    oAuth2Client.setCredentials({
      access_token: oauth_access_token,
      refresh_token: oauth_refresh_token,
    });

    const peopleService = google.people({ version: 'v1', auth: oAuth2Client });

    let contacts = [];
    let nextPageToken = null;

    do {
      const response = await peopleService.people.connections.list({
        resourceName: 'people/me',
        pageSize: 1000,
        pageToken: nextPageToken,
        personFields: 'names,phoneNumbers,emailAddresses',
      });

      const connections = response.data.connections || [];

      const pageContacts = connections.map((person) => ({
        name: person.names?.[0]?.displayName || '',
        email: person.emailAddresses?.[0]?.value || '',
        phone: person.phoneNumbers?.[0]?.value || '',
      }));

      contacts.push(...pageContacts);

      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken);

    // Optionally sort by name
    contacts.sort((a, b) => a.name.localeCompare(b.name));

    res.json({ success: true, contacts });
  } catch (err) {
    console.error("Error fetching contacts:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch contacts" });
  }
};


async function refreshAccessToken(refreshToken) {
  const res = await axios.post('https://oauth2.googleapis.com/token', null, {
    params: {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }
  });
  return res.data.access_token;
}

async function getTokenScopes(accessToken) {
  const res = await axios.get(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`);
  return res.data.scope;
}

const get_userScopes = async (req, res) => {
  const { oauth_access_token, oauth_refresh_token } = req.query;
  
  try {
    const scopes = await getTokenScopes(oauth_access_token);
    return res.json({ scopes, refreshed: false });

  } catch (e) {
    console.log(e);
    
    if (e.response && e.response.data.error_description === 'Invalid Value') {
      try {
        // console.log('Access token expired, refreshing...');
        const newAccessToken = await refreshAccessToken(oauth_refresh_token);
        const scopes = await getTokenScopes(newAccessToken);
        // console.log('Scopes after refresh:', scopes);

        // Optionally: update the newAccessToken in your DB here

        return res.json({ scopes, refreshed: true });
      } catch (refreshError) {
        console.error('Error refreshing access token:', refreshError.message);
        return res.status(500).json({ error: 'Failed to refresh access token' });
      }
    } else {
      console.error('Error fetching scopes:', e.message);
      return res.status(500).json({ error: 'Failed to fetch scopes' });
    }
  }
};

async function getUserTokensFromDB(email) {
  const query = `
    SELECT mp.oauth_access_token, mp.oauth_refresh_token
    FROM sell.member_profiles mp
    JOIN sell.user_credentials uc 
    ON mp.user_id = uc.user_id
    WHERE uc.username = $1
  `;
  const result = await ambarsariyaPool.query(query, [email]);
  return result.rows[0] || null;
}

const post_checkCalendarAccess = async (req, res) => {
  const {email} = req.body ;
  console.log(email);
  
  try {
    const user = await getUserTokensFromDB(email);

    if (!user || !user.oauth_access_token || !user.oauth_refresh_token) {
      return res.json({ needsPermission: true, reason: "NO_TOKEN" });
    }

    let accessToken = user.oauth_access_token;

    try {
      const scopes = await getTokenScopes(accessToken);
      const hasCalendarScope = scopes.includes("https://www.googleapis.com/auth/calendar.events");

      if (!hasCalendarScope) {
        return res.json({ needsPermission: true, reason: "NO_CALENDAR_SCOPE" });
      }

      return res.json({ needsPermission: false, oauthTokens: user });
    } catch (error) {
      if (error.response && error.response.status === 400) {
        // Try refreshing the access token
        try {
          const newAccessToken = await refreshAccessToken(user.oauth_refresh_token);
          const scopes = await getTokenScopes(newAccessToken);

          const hasCalendarScope = scopes.includes("https://www.googleapis.com/auth/calendar.events");

          if (!hasCalendarScope) {
            return res.json({ needsPermission: true, reason: "NO_CALENDAR_SCOPE" });
          }

          // You may want to update DB with new access token here
          return res.json({ needsPermission: false, oauthTokens: { ...user, oauth_access_token: newAccessToken } });
        } catch (refreshError) {
          return res.json({ needsPermission: true, reason: "REFRESH_FAILED" });
        }
      } else {
        return res.json({ needsPermission: true, reason: "INVALID_OR_EXPIRED_TOKEN" });
      }
    }
  } catch (err) {
    console.error("Internal server error:", err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

const post_scheduleGoogleCalendarAppointment2 = async (req, res) => {
  const {
    requester_email,
    requester_id,
    co_helper_email,
    co_helper_id,
    task_date,
    task_time,
    estimated_hours,
    task_details,
    task_location,
    requester_name,
    co_helper_type,
  } = req.body;

  try {
    // 1. Fetch requester's tokens (they will be the organizer)
    const requester = await getUserTokensFromDB(requester_email);
    if (!requester || !requester.oauth_access_token) {
      return res.json({
        success: false,
        message: "You have not authorized access to Google Calendar",
      });
    }

    let accessToken = requester.oauth_access_token;

    // 2. Check access token validity
    try {
      await axios.get(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`);
    } catch (error) {
      if (requester.oauth_refresh_token) {
        accessToken = await refreshAccessToken(requester.oauth_refresh_token);

        // Update the DB with the new token
        await ambarsariyaPool.query(
          `UPDATE sell.member_profiles SET oauth_access_token = $1 WHERE member_id = $2`,
          [accessToken, requester_id]
        );
      } else {
        return res.status(401).json({
          success: false,
          message: "Token expired and no refresh token found for requester",
        });
      }
    }

    // 3. Calculate start and end times
    const eventStart = new Date(`${task_date}T${task_time}`);
    const eventEnd = new Date(eventStart.getTime() + estimated_hours * 60 * 60 * 1000);

    // 4. Prepare event
    const event = {
      summary: `Task with ${co_helper_type}`,
      description: task_details,
      location: task_location,
      start: {
        dateTime: eventStart.toISOString(),
        timeZone: "Asia/Kolkata",
      },
      end: {
        dateTime: eventEnd.toISOString(),
        timeZone: "Asia/Kolkata",
      },
      attendees: [
        {
          email: co_helper_email,
          responseStatus: "needsAction", // will send invite
        },
      ],
      reminders: {
        useDefault: true,
      },
    };

    // 5. Send event to requester's calendar (they become the organizer)
    const response = await axios.post(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all`,
      event,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const eventId = response.data.id;

    res.json({
      success: true,
      message: "Appointment scheduled. Co-helper notified via email.",
      eventId
    });
  } catch (err) {
    console.error("Calendar Scheduling Error:", err?.response?.data || err.message);
    res.json({
      success: false,
      message: "An error occurred while scheduling the appointment",
    });
  }
};

const post_updateGoogleCalendarEventResponse = async (req, res) => {
  const {
    member_email,        // Email of the co-helper responding
    member_id,           // Their ID
    event_id,            // Google Calendar Event ID
    calendar_id = "primary", // Optional calendar ID
    response_status,     // 'accepted' | 'declined' | 'tentative'
    notification_id      // ID of the notification row to update in DB
  } = req.body;

  if (!["accepted", "declined", "tentative"].includes(response_status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid response status",
    });
  }

  try {
    // 1. Fetch tokens of the co-helper (they are responding to event)
    const user = await getUserTokensFromDB(member_email);
    if (!user || !user.oauth_access_token) {
      return res.status(401).json({
        success: false,
        message: "You have not authorized Google Calendar",
      });
    }

    let accessToken = user.oauth_access_token;

    // 2. Check token validity
    try {
      await axios.get(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`);
    } catch (error) {
      if (user.oauth_refresh_token) {
        accessToken = await refreshAccessToken(user.oauth_refresh_token);
        await ambarsariyaPool.query(
          `UPDATE sell.member_profiles SET oauth_access_token = $1 WHERE member_id = $2`,
          [accessToken, member_id]
        );
      } else {
        return res.status(401).json({
          success: false,
          message: "Access token expired and no refresh token found",
        });
      }
    }

    // 3. Get the event details
    const eventRes = await axios.get(`https://www.googleapis.com/calendar/v3/calendars/${calendar_id}/events/${event_id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const event = eventRes.data;

    // 4. Update the attendee's response status
    const updatedAttendees = event.attendees?.map((attendee) => {
      if (attendee.email === member_email) {
        return {
          ...attendee,
          responseStatus: response_status,
        };
      }
      return attendee;
    });

    if (!updatedAttendees) {
      return res.status(404).json({
        success: false,
        message: "Attendee not found in event",
      });
    }

    // 5. Patch the event with updated attendee status
    await axios.patch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendar_id}/events/${event_id}?sendUpdates=all`,
      { attendees: updatedAttendees },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // 6. Update the notification status in DB
    if (notification_id) {
      await ambarsariyaPool.query(
        `UPDATE sell.co_helper_notifications SET status = $1 WHERE id = $2`,
        [response_status, notification_id]
      );
    }

    res.json({
      success: true,
      message: `Event response updated to '${response_status}'`,
    });
  } catch (err) {
    console.error("Update RSVP Error:", err?.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: "Failed to update event response",
    });
  }
};

const post_scheduleGoogleCalendarAppointment = async (req, res) => {
  const {
    requester_email,
    requester_id,
    co_helper_email,
    co_helper_id,
    task_date,
    task_time,
    estimated_hours,
    task_details,
    task_location,
    requester_name,
    response_status,
    notification_id,
    co_helper_type,
    service,
    offerings,
    calendar_id = "primary",
  } = req.body;
console.log(req.body);

  try {
    // Step 1: Fetch requester's access token
    const requester = await getUserTokensFromDB(requester_email);
    if (!requester || !requester.oauth_access_token) {
      return res.status(401).json({ success: false, message: "You have not authorized access to Google Calendar" });
    }

    let accessToken = requester.oauth_access_token;

    // Step 2: Validate or refresh requester's token
    try {
      await axios.get(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`);
    } catch {
      if (requester.oauth_refresh_token) {
        accessToken = await refreshAccessToken(requester.oauth_refresh_token);
        await ambarsariyaPool.query(
          `UPDATE sell.member_profiles SET oauth_access_token = $1 WHERE member_id = $2`,
          [accessToken, requester_id]
        );
      } else {
        return res.status(401).json({ success: false, message: "Token expired and no refresh token found for requester" });
      }
    }

    // Step 3: Calculate start/end time using dayjs with timezone
    const [hour, minute, second] = task_time.split(':').map(Number);

    // Base date in Asia/Kolkata
    const start = dayjs(task_date).tz('Asia/Kolkata').hour(hour).minute(minute).second(second || 0);
    const end = start.add(estimated_hours, 'hour');

    // ISO string with offset
    const eventStart = start.format();  // 'YYYY-MM-DDTHH:mm:ssZ'
    const eventEnd = end.format();

    // Step 4: Fetch co-helper tokens
    const coHelper = await getUserTokensFromDB(co_helper_email);
    if (!coHelper || !coHelper.oauth_access_token) {
      return res.status(400).json({ success: false, message: "Co-helper has not authorized Google Calendar" });
    }

    let coHelperAccessToken = coHelper.oauth_access_token;

    try {
      await axios.get(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${coHelperAccessToken}`);
    } catch {
      if (coHelper.oauth_refresh_token) {
        coHelperAccessToken = await refreshAccessToken(coHelper.oauth_refresh_token);
        await ambarsariyaPool.query(
          `UPDATE sell.member_profiles SET oauth_access_token = $1 WHERE member_id = $2`,
          [coHelperAccessToken, co_helper_id]
        );
      } else {
        return res.status(401).json({ success: false, message: "Co-helper token expired and no refresh token found" });
      }
    }

    // Step 5: Check co-helper availability
    const coHelperAuth = new google.auth.OAuth2();
    coHelperAuth.setCredentials({ access_token: coHelperAccessToken });

    const calendar = google.calendar({ version: 'v3', auth: coHelperAuth });

    const freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: eventStart,
        timeMax: eventEnd,
        items: [{ id: calendar_id }],
      },
    });

    const busySlots = freeBusy.data.calendars[calendar_id].busy;
    if (busySlots.length > 0) {
      return res.status(409).json({ success: false, message: "Co-helper is busy during this time slot" });
    }

    // Step 6: Create event
    const event = {
      summary: `Task with ${co_helper_type}`,
      description: `Description: ${task_details}\nKey service: ${service}\nOfferings: ${offerings}`,
      location: task_location,
      start: {
        dateTime: eventStart,
        timeZone: "Asia/Kolkata",
      },
      end: {
        dateTime: eventEnd,
        timeZone: "Asia/Kolkata",
      },
      attendees: [
        {
          email: co_helper_email,
          responseStatus: "needsAction",
        },
      ],
      reminders: {
        useDefault: true,
      },
    };

    const createRes = await axios.post(
      `https://www.googleapis.com/calendar/v3/calendars/${calendar_id}/events?sendUpdates=all`,
      event,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const eventId = createRes.data.id;

    // Step 7: Store event ID in DB
    await ambarsariyaPool.query(
      `UPDATE sell.co_helper_notifications SET calendar_event_id = $1 WHERE id = $2`,
      [eventId, notification_id]
    );

    // Step 8: Update attendee's responseStatus (accepted/declined/etc.)
    const updatedAttendees = createRes.data.attendees?.map((attendee) =>
      attendee.email === co_helper_email
        ? { ...attendee, responseStatus: response_status }
        : attendee
    );

    if (updatedAttendees) {
      await axios.patch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendar_id}/events/${eventId}?sendUpdates=all`,
        { attendees: updatedAttendees },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
    }

    // Step 9: Update DB status
    if (notification_id) {
      await ambarsariyaPool.query(
        `UPDATE sell.co_helper_notifications SET status = $1 WHERE id = $2`,
        [response_status, notification_id]
      );
    }

    // Step 10: Final Response
    return res.json({
      success: true,
      message: `Appointment scheduled successfully. Co-helper response: ${response_status}`,
      eventId: eventId,
      htmlLink: createRes.data.htmlLink,
    });
  } catch (err) {
    console.error("Error scheduling event:", err?.response?.data || err.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while scheduling the appointment",
    });
  }
};


const delete_googleCalendarEvent = async (req, res) => {
  const {
    organizer_email,
    organizer_id,
    event_id,
    calendar_id = "primary",
    notification_id
  } = req.body;

  try {
    // 1. Fetch organizer's OAuth tokens
    const user = await getUserTokensFromDB(organizer_email);
    if (!user || !user.oauth_access_token) {
      return res.status(401).json({
        success: false,
        message: "You have not authorized Google Calendar",
      });
    }

    let accessToken = user.oauth_access_token;

    // 2. Validate or refresh token
    try {
      await axios.get(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`);
    } catch (error) {
      if (user.oauth_refresh_token) {
        accessToken = await refreshAccessToken(user.oauth_refresh_token);
        await ambarsariyaPool.query(
          `UPDATE sell.member_profiles SET oauth_access_token = $1 WHERE member_id = $2`,
          [accessToken, organizer_id]
        );
      } else {
        return res.status(401).json({
          success: false,
          message: "Access token expired and no refresh token found",
        });
      }
    }

    // 3. Delete event from Google Calendar
    await axios.delete(
      `https://www.googleapis.com/calendar/v3/calendars/${calendar_id}/events/${event_id}?sendUpdates=all`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // 4. Optionally update DB to reflect cancellation
    if (notification_id) {
      await ambarsariyaPool.query(
        `DELETE FROM sell.co_helper_notifications
         WHERE id = $1`,
        [notification_id]
      );
    }

    res.json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (err) {
    console.error("Event Deletion Error:", err?.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: "Failed to delete calendar event",
    });
  }
};



module.exports = {
  post_openFile,
  post_openItemsCSVFile,
  post_openSKUCSVFile,
  post_openRKUCSVFile,
  get_checkDriveAccess,
  get_checkGoogleAccess,
  get_requestDriveAccess,
  get_requestGoogleAccess,
  post_requestDynamicGoogleAccess,
  get_handleAuthCallback,
  handleAuthCallback2,
  get_imageLink,
  get_sheetsData,
  getGoogleContacts,
  get_userScopes,
  post_checkCalendarAccess,
  post_scheduleGoogleCalendarAppointment,
  post_updateGoogleCalendarEventResponse,
  delete_googleCalendarEvent
};
