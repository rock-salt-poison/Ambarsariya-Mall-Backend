const { google } = require("googleapis");
require("dotenv").config();

// 1️⃣ OAuth2 for User Authentication (Login)
const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// 2️⃣ Service Account for Fetching Files from Google Drive & Sheets
const serviceAccount = {
  type: "service_account",
  project_id: process.env.GCP_PROJECT_ID,
  private_key_id: process.env.GCP_PRIVATE_KEY_ID,
  private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, "\n"), // Fix multi-line issue
  client_email: process.env.GCP_CLIENT_EMAIL,
  client_id: process.env.GCP_CLIENT_ID,
  auth_uri: process.env.GCP_AUTH_URI,
  token_uri: process.env.GCP_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.GCP_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.GCP_CLIENT_X509_CERT_URL,
};

// Authenticate Google APIs with Service Account
const serviceAuth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: [
    "https://www.googleapis.com/auth/drive.readonly", // For Google Drive
     "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/spreadsheets.readonly", // For Google Sheets
  ],
});

// ✅ Google Drive API Client
const driveService = google.drive({ version: "v3", auth: serviceAuth });

// ✅ Google Sheets API Client (Fixing the Issue)
const sheetsService = google.sheets({ version: "v4", auth: serviceAuth });

module.exports = { oAuth2Client, driveService, sheetsService };
