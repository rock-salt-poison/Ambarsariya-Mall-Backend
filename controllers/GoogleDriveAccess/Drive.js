require("dotenv").config();
const { google } = require("googleapis");
const fs = require("fs");

const auth = new google.auth.GoogleAuth({
  credentials: {
    type: "service_account",
    project_id: process.env.GCP_PROJECT_ID,
    private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.GCP_CLIENT_EMAIL,
    client_id: process.env.GCP_CLIENT_ID,
  },
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({ version: "v3", auth });

const BASE_FOLDER_NAME = "Ambarsariya_Emall";
const FILE_NAME = "Products.xlsx"; // Original file name

// Get or create base folder
async function getBaseFolder() {
  let folderRes = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${BASE_FOLDER_NAME}' and trashed=false`,
    fields: "files(id, name)",
  });

  if (folderRes.data.files.length) {
    return folderRes.data.files[0].id;
  }

  // Create folder if not found
  const folder = await drive.files.create({
    requestBody: { name: BASE_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" },
    fields: "id",
  });

  console.log(`📁 Created folder: ${BASE_FOLDER_NAME}`);
  return folder.data.id;
}

// Check if file exists in the folder
async function getFile(folderId) {
  const query = `mimeType='application/vnd.google-apps.spreadsheet' and name='Products (Google Sheet)' and '${folderId}' in parents and trashed=false`;
  const res = await drive.files.list({ q: query, fields: "files(id, name, webViewLink)" });

  return res.data.files.length ? res.data.files[0] : null;
}

// Upload Excel file and convert to Google Sheets
async function uploadFile(folderId) {
  const fileMetadata = {
    name: "Products (Google Sheet)", // Name after conversion
    parents: [folderId],
    mimeType: "application/vnd.google-apps.spreadsheet", // Convert to Google Sheet
  };
  const media = {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    body: fs.createReadStream("Products.xlsx"),
  };

  const file = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: "id",
  });

  console.log(`📄 Uploaded and converted file to Google Sheet: Products.xlsx`);
  return file.data;
}

// Grant user permission to access the file
async function grantPermission(email, fileId) {
  try {
    await drive.permissions.create({
      fileId,
      requestBody: { type: "user", role: "writer", emailAddress: email },
    });
  } catch (error) {
    console.error("❌ Failed to grant permission:", error.message);
  }
}

// Main function to handle the process
async function processDrive(email) {
  try {
    // Step 1: Get or create base folder
    const folderId = await getBaseFolder();

    // Step 2: Check if file exists in the folder
    let file = await getFile(folderId);

    if (file) {
      console.log("✅ File already exists. Granting access...");
      await grantPermission(email, file.id);
      return { success: true, url: `https://docs.google.com/spreadsheets/d/${file.id}/edit` };
    }

    // Step 3: Upload file if not found
    file = await uploadFile(folderId);
    await grantPermission(email, file.id);

    return { success: true, url: `https://docs.google.com/spreadsheets/d/${file.id}/edit` };
  } catch (error) {
    console.error("❌ Error processing Drive:", error.message);
    return { success: false, message: error.message };
  }
}

module.exports = { processDrive };
