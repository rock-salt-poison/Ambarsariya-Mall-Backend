require("dotenv").config();
const { google } = require("googleapis");
const fs = require("fs");
const { oAuth2Client } = require("./GoogleAuth");
const { createDbPool } = require("../../db_config/db");
const XLSX = require("xlsx");


const ambarsariyaPool = createDbPool();

async function getBaseFolder(drive, email) {
  try {
    const folderName = `Ambarsariya_Emall_${email}`;
    
    const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;

    let folderRes = await drive.files.list({ q: query, fields: "files(id, name, owners)" });

    if (folderRes.data.files.length) {
      const folder = folderRes.data.files[0];

      if (folder.owners && folder.owners.length > 0) {
        const ownerEmail = folder.owners[0].emailAddress;
        
        if (ownerEmail !== email) {
          console.log(`Found folder '${folderName}', but it belongs to ${ownerEmail}, not ${email}. Creating a new one.`);
        } else {
          console.log("Folder found for user:", email, folder.id);
          return folder.id;
        }
      }
    }

    // Create a new folder specific to this user
    const folder = await drive.files.create({
      requestBody: { 
        name: folderName,
        mimeType: "application/vnd.google-apps.folder"
      },
      fields: "id",
    });

    console.log("New folder created for user:", email, folder.data.id);
    return folder.data.id;
  } catch (error) {
    console.error("Error getting/creating user-specific folder:", error.message);
    throw new Error("Failed to get or create user-specific base folder.");
  }
}

async function createSubFolders(drive, parentFolderId, serviceAccountEmail) {
  try {
    const subFolders = ["product_images", "product_catalog", "brand_catalog"];
    const folderIds = {};

    for (const folderName of subFolders) {
      const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentFolderId}' in parents and trashed=false`;

      const folderRes = await drive.files.list({ q: query, fields: "files(id, name)" });

      if (folderRes.data.files.length === 0) {
        const folder = await drive.files.create({
          requestBody: {
            name: folderName,
            parents: [parentFolderId],
            mimeType: "application/vnd.google-apps.folder",
          },
          fields: "id",
        });

        console.log(`✅ Sub-folder '${folderName}' created inside base folder.`);
        folderIds[folderName] = folder.data.id;

        // Grant permission to service account
        await grantPermissionToFolder(drive, folder.data.id, serviceAccountEmail);
      } else {
        console.log(`⚠️ Sub-folder '${folderName}' already exists.`);
        folderIds[folderName] = folderRes.data.files[0].id;
      }
    }

    return folderIds;
  } catch (error) {
    console.error("❌ Error creating sub-folders:", error.message);
    throw new Error("Failed to create sub-folders.");
  }
}

async function grantPermissionToFolder(drive, folderId, serviceAccountEmail) {
  try {
    await drive.permissions.create({
      fileId: folderId,
      requestBody: {
        role: "writer", // Give edit access
        type: "user",
        emailAddress: serviceAccountEmail,
      },
      fields: "id",
    });

    console.log(`✅ Permission granted to service account for folder ID: ${folderId}`);
  } catch (error) {
    console.error(`❌ Error granting permission to folder ${folderId}:`, error.message);
    throw new Error("Failed to grant permission.");
  }
}



async function getUserFile(drive, folderId, email) {
  try {
    const query = `mimeType='application/vnd.google-apps.spreadsheet' and name='Products_${email}' and '${folderId}' in parents and trashed=false`;

    const res = await drive.files.list({ q: query, fields: "files(id, name, webViewLink)" });

    return res.data.files.length ? res.data.files[0] : null;
  } catch (error) {
    throw new Error("Failed to check user file.");
  }
}

async function uploadFile(drive, folderId, email) {
  try {
    const fileMetadata = {
      name: `Products_${email}`,
      parents: [folderId], // Folder created inside User's Drive
      mimeType: "application/vnd.google-apps.spreadsheet",
    };
    const media = {
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: fs.createReadStream("Products.xlsx"),
    };
    
    const file = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id, webViewLink, owners",
    });
    
    console.log("✅ File Created:", file.data.webViewLink, "Owned by:", file.data.owners);
    
    await grantPermission(drive, email, file.data.id);

    return file.data;
    
  } catch (error) {
    throw new Error("Failed to upload file.");
  }
}

async function grantPermission(drive, email, fileId) {
  try {
    // 🔹 Define service account email (Replace with actual service account email)
    const SERVICE_ACCOUNT_EMAIL = process.env.GCP_CLIENT_EMAIL;

    const permissions = [
      { type: "user", role: "writer", emailAddress: email }, // Grant user access
      { type: "user", role: "writer", emailAddress: SERVICE_ACCOUNT_EMAIL } // Grant service account access
    ];

    for (const perm of permissions) {
      await drive.permissions.create({
        fileId,
        requestBody: perm,
      });
    }

    console.log(`✅ Permissions granted to ${email} and ${SERVICE_ACCOUNT_EMAIL}`);
  } catch (error) {
    throw new Error("Failed to grant permission.");
  }
}



async function removeFirstSheet(sheets, spreadsheetId) {
  try {
    // Fetch spreadsheet details
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });

    // Get all sheets
    const sheetList = spreadsheet.data.sheets;
    
    if (sheetList.length <= 1) {
      console.log("Only one sheet exists, cannot remove.");
      return;
    }

    // Get the first sheet's details
    const firstSheet = sheetList[0];
    const firstSheetId = firstSheet.properties.sheetId;
    const firstSheetName = firstSheet.properties.title;

    // Check if the first sheet's name is "Products"
    if (firstSheetName.toLowerCase() === "products") {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ deleteSheet: { sheetId: firstSheetId } }],
        },
      });

      console.log(`✅ First sheet '${firstSheetName}' removed successfully.`);
    } else {
      console.log(`ℹ️ First sheet '${firstSheetName}' is not 'Products', skipping deletion.`);
    }
  } catch (error) {
    console.error("❌ Error removing first sheet:", error.message);
    throw new Error("Failed to remove the first sheet.");
  }
}



async function addSheetToFile(sheets, spreadsheetId, category) {
  try {
    // Fetch spreadsheet details
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });

    // Get all existing sheet names
    const sheetList = spreadsheet.data.sheets.map(sheet => sheet.properties.title);

    // Check if the sheet already exists
    if (sheetList.includes(category)) {
      console.log(`⚠️ Sheet '${category}' already exists. Skipping creation.`);
    } else {
      // Create a new sheet
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: { properties: { title: category } },
            },
          ],
        },
      });

      console.log(`✅ Sheet '${category}' created successfully.`);
    }

    // Read the structure of the Products.xlsx file
    const workbook = XLSX.readFile("Products.xlsx");
    const sheetName = workbook.SheetNames[0]; // Assuming first sheet
    const worksheet = workbook.Sheets[sheetName];

    // Convert XLSX data to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Find the Category column index
    const headerRow = jsonData[0]; // First row (headers)
    const categoryIndex = headerRow.findIndex((col) => col.toLowerCase() === "category");

    if (categoryIndex === -1) {
      throw new Error("Category column not found in Products.xlsx.");
    }

    // Prefill Category column with the sheet name
    const updatedData = jsonData.map((row, index) => {
      if (index === 0) return row; // Keep headers unchanged
      row[categoryIndex] = category; // Fill category column
      return row;
    });

    // Update the Google Sheet with the modified data
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${category}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: updatedData },
    });

    console.log(`✅ Data updated in sheet '${category}'.`);
  } catch (error) {
    console.error("❌ Error adding/updating sheet:", error.message);
    throw new Error("Failed to add/update sheet.");
  }
}


async function processDrive(email) {
  try {
    const result = await ambarsariyaPool.query(
      `SELECT ef.oauth_access_token, 
              ef.oauth_refresh_token, 
              ARRAY_AGG(c.category_name) AS category_names 
       FROM sell.eshop_form ef
       JOIN sell.user_credentials uc ON ef.user_id = uc.user_id
       JOIN public.categories c ON c.category_id = ANY(ef.category)  
       WHERE uc.username = $1
       GROUP BY ef.oauth_access_token, ef.oauth_refresh_token;`,
      [email]
    );

    if (!result.rowCount) throw new Error("User not authenticated.");

    const { oauth_access_token, oauth_refresh_token, category_names } = result.rows[0];

    oAuth2Client.setCredentials({
      access_token: oauth_access_token,
      refresh_token: oauth_refresh_token,
    });

    const drive = google.drive({ version: "v3", auth: oAuth2Client });
    const sheets = google.sheets({ version: "v4", auth: oAuth2Client });

    // Step 1: Get or create base folder
    const folderId = await getBaseFolder(drive, email);

    // Step 2: Create sub-folders & store their IDs
    const serviceAccountEmail = process.env.GCP_CLIENT_EMAIL;
    const subFolderIds = await createSubFolders(drive, folderId, serviceAccountEmail);

    // Step 3: Check if file exists, else create it
    let file = await getUserFile(drive, folderId, email);
    if (!file) file = await uploadFile(drive, folderId, email);

    // Step 4: Add new category sheets
    for (const category of category_names) {
      await addSheetToFile(sheets, file.id, category);
    }

    await removeFirstSheet(sheets, file.id);

    await grantPermission(drive, email, file.id);

    return { success: true, url: `https://docs.google.com/spreadsheets/d/${file.id}/edit` };
  } catch (error) {
    console.error("❌ Error processing Drive:", error.message);
    return { success: false, message: error.message };
  }
}


module.exports = { processDrive };
