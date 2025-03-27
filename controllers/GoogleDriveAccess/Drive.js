require("dotenv").config();
const { google } = require("googleapis");
const fs = require("fs");
const { oAuth2Client, sheetsService } = require("./GoogleAuth");
const { createDbPool } = require("../../db_config/db");
const XLSX = require("xlsx");


const ambarsariyaPool = createDbPool();

const adminSheetId = process.env.ADMIN_SHEET_ID; // Ensure this is set in `.env`
const adminItemSheetId = process.env.ADMIN_ITEM_SHEET_ID;
const adminSkuSheetId = process.env.ADMIN_SKU_SHEET_ID;
const adminRkuSheetId = process.env.ADMIN_RKU_SHEET_ID;

const serviceAccountEmail = process.env.GCP_CLIENT_EMAIL;

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

        console.log(`Sub-folder '${folderName}' created inside base folder.`);
        folderIds[folderName] = folder.data.id;

        // Grant permission to service account
        await grantPermissionToFolder(drive, folder.data.id, serviceAccountEmail);
      } else {
        console.log(`Sub-folder '${folderName}' already exists.`);
        folderIds[folderName] = folderRes.data.files[0].id;
      }
    }

    return folderIds;
  } catch (error) {
    console.error("Error creating sub-folders:", error.message);
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

    console.log(`Permission granted to service account for folder ID: ${folderId}`);
  } catch (error) {
    console.error(`Error granting permission to folder ${folderId}:`, error.message);
    throw new Error("Failed to grant permission.");
  }
}



async function getProductsFile(drive, folderId, email) {
  try {
    const query = `mimeType='application/vnd.google-apps.spreadsheet' and name='Products_${email}' and '${folderId}' in parents and trashed=false`;

    const res = await drive.files.list({ q: query, fields: "files(id, name, webViewLink)" });

    return res.data.files.length ? res.data.files[0] : null;
  } catch (error) {
    throw new Error("Failed to check products file.");
  }
}

async function getItemsFile(drive, folderId, email) {
  try {
    const query = `mimeType='application/vnd.google-apps.spreadsheet' and name='Items_${email}' and '${folderId}' in parents and trashed=false`;

    const res = await drive.files.list({ q: query, fields: "files(id, name, webViewLink)" });

    return res.data.files.length ? res.data.files[0] : null;
  } catch (error) {
    throw new Error("Failed to check items file.");
  }
}

async function getSKUFile(drive, folderId, email) {
  try {
    const query = `mimeType='application/vnd.google-apps.spreadsheet' and name='SKU_${email}' and '${folderId}' in parents and trashed=false`;

    const res = await drive.files.list({ q: query, fields: "files(id, name, webViewLink)" });

    return res.data.files.length ? res.data.files[0] : null;
  } catch (error) {
    throw new Error("Failed to check sku file.");
  }
}

async function getRKUFile(drive, folderId, email) {
  try {
    const query = `mimeType='application/vnd.google-apps.spreadsheet' and name='RKU_${email}' and '${folderId}' in parents and trashed=false`;

    const res = await drive.files.list({ q: query, fields: "files(id, name, webViewLink)" });

    return res.data.files.length ? res.data.files[0] : null;
  } catch (error) {
    throw new Error("Failed to check rku file.");
  }
}

async function copyAdminSheet(drive, sheets, folderId, email) {
  try {
    console.log(`Creating a new Google Sheet inside User's My Drive...`);

    // Step 1: Create a new Google Sheet in User's My Drive
    const fileMetadata = {
      name: `Products_${email}`,
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [folderId],
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id, webViewLink, owners",
    });

    if (!file || !file.data || !file.data.id) {
      console.error('File creation failed, no file data received.');
      return;
    }

    const userSheetId = file.data.id;
    console.log(`Sheet created successfully! ID: ${userSheetId}`);

    // Step 2: Get Admin Sheet Details
    console.log("Fetching Admin Sheet data...");
    const adminSheets = await sheets.spreadsheets.get({
      spreadsheetId: adminSheetId,
      includeGridData: true,
    });

    const adminSheet = adminSheets.data.sheets[0]; // Assuming first sheet
    const adminSheetName = adminSheet.properties.title;

    // Get total columns & rows dynamically
    const totalColumns = adminSheet.properties.gridProperties.columnCount;
    const totalRows = adminSheet.properties.gridProperties.rowCount;

    // Find the last non-empty row dynamically
    let lastRow = 0;
    let lastColumn = 0;
    let headerRow = [];  // To store header names

    adminSheet.data[0].rowData.forEach((row, rowIndex) => {
      if (row.values && row.values.some(cell => cell.effectiveValue)) {
        lastRow = rowIndex + 1; // Last non-empty row
      }
      row.values?.forEach((cell, colIndex) => {
        if (cell.effectiveValue) {
          lastColumn = Math.max(lastColumn, colIndex + 1);
        }
        // Collect headers in the first row
        if (rowIndex === 0 && cell.effectiveValue) {
          headerRow.push(cell.effectiveValue);
        }
      });
    });

    console.log(`Admin Sheet: ${lastRow} rows, ${lastColumn} columns`);

    console.log(headerRow);
    
    // Convert column index to letter notation
    const getColumnLetter = (colIndex) => {
      let letter = "";
      while (colIndex >= 0) {
        letter = String.fromCharCode((colIndex % 26) + 65) + letter;
        colIndex = Math.floor(colIndex / 26) - 1;
      }
      return letter;
    };

    const lastColumnLetter = getColumnLetter(lastColumn - 1);
    const range = `${adminSheetName}!A1:${lastColumnLetter}${lastRow}`;
    console.log(`Fetching data from range: ${range}`);

    // Fetch data
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: adminSheetId,
      range: range,
    });

    const values = dataResponse.data.values || [];
    console.log("Data fetched successfully!");

    // Grant user permission
    await grantPermission(drive, email, userSheetId);

    // Get User Sheet details
    const userSheets = await sheets.spreadsheets.get({ spreadsheetId: userSheetId });
    const userSheet = userSheets.data.sheets[0]; // Assuming first sheet
    const userSheetName = userSheet.properties.title;

    // Step 3: Expand User Sheet Rows & Columns If Needed
    const updateRequests = [];

    if (lastColumn > userSheet.properties.gridProperties.columnCount) {
      console.log(`Expanding columns from ${userSheet.properties.gridProperties.columnCount} to ${lastColumn}...`);
      updateRequests.push({
        updateSheetProperties: {
          properties: {
            sheetId: userSheet.properties.sheetId,
            gridProperties: { columnCount: lastColumn },
          },
          fields: "gridProperties.columnCount",
        },
      });
    }

    if (lastRow > userSheet.properties.gridProperties.rowCount) {
      console.log(`Expanding rows from ${userSheet.properties.gridProperties.rowCount} to ${lastRow}...`);
      updateRequests.push({
        updateSheetProperties: {
          properties: {
            sheetId: userSheet.properties.sheetId,
            title:"Products",
            gridProperties: { rowCount: lastRow },
          },
          fields: "gridProperties.rowCount",
        },
      });
    }

    if (updateRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: userSheetId,
        requestBody: { requests: updateRequests },
      });
      console.log("Sheet expanded successfully!");
    }

    // Step 4: Copy Data from Admin Sheet to User Sheet
    if (values.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: userSheetId,
        range: `${userSheetName}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });
      console.log("Data copied successfully!");
    } else {
      console.log("No data found in Admin Sheet.");
    }

    // Step 5: Copy Formatting & Data Validation
    console.log("Copying formatting and data validation...");

    const requests = [];
    const lastRowIndex = lastRow; // Ensure this is dynamic, use lastRow

    const headers = headerRow.map(header => header.stringValue);  // Extract stringValue
    console.log("Headers: ", headers);

    // Step 6: Apply formulas based on column headers
    const ikColumnIndex = headers.indexOf('IKU (ITEM Keeping Unit)');
    const areaColumnIndex = headers.indexOf('AREA (Size lateral)');
    const variantGroupColumnIndex = headers.indexOf('Variant Group');
    const productNoIndex = headers.indexOf('Product No');

    console.log('product index ', productNoIndex);
    
    // Loop through the rows and columns to apply dynamic formulas
    adminSheet.data[0].rowData.forEach((row, rowIndex) => {
      if (rowIndex >= lastRowIndex) return;
      if (!row.values) return;

      row.values.forEach((cell, colIndex) => {
        if (colIndex >= lastColumn) return;

        const formatRequest = {};
        if (cell.effectiveFormat) {
          formatRequest.userEnteredFormat = cell.effectiveFormat;
        }
        if (cell.dataValidation) {
          formatRequest.dataValidation = cell.dataValidation;
        }

        
        

        // Apply formulas based on column headers
        if (productNoIndex !== -1) {
          requests.push({
            updateCells: {
              range: {
                sheetId: userSheet.properties.sheetId,
                startRowIndex: rowIndex +1,
                startColumnIndex: productNoIndex, // Adjust to the correct column where IKU is
                endRowIndex: rowIndex + 5,
                endColumnIndex: productNoIndex + 1, // Adjust the column range
              },
              rows: [{ values: [{ userEnteredValue: { formulaValue: `=IF(B${rowIndex + 2} <> "", ROW(A${rowIndex + 1}) - 1, "")`, } }] }],
              fields: "userEnteredValue.formulaValue",
            },
          });
        }

        if (ikColumnIndex) {
          requests.push({
            updateCells: {
              range: {
                sheetId: userSheet.properties.sheetId,
                startRowIndex: rowIndex + 1 ,
                startColumnIndex: ikColumnIndex , // Adjust to the correct column where IKU is
                endRowIndex: rowIndex + 5,
                endColumnIndex: ikColumnIndex + 1, // Adjust the column range
              },
              rows: [{ values: [{ userEnteredValue: { formulaValue: `=TEXTJOIN(", ", TRUE, 
                  IF(W${rowIndex + 2} <> "", SUBSTITUTE(B${rowIndex + 2} & "_" & C${rowIndex + 2} & "_" & W${rowIndex + 2} & "_" & 
                    IF(COUNTA(W${rowIndex + 2}:Z${rowIndex + 2}) > 0, QUOTIENT(T${rowIndex + 2}, COUNTA(W${rowIndex + 2}:Z${rowIndex + 2})) + IF(COLUMN(W${rowIndex + 2}) - COLUMN(W${rowIndex + 2}) < MOD(T${rowIndex + 2}, COUNTA(W${rowIndex + 2}:Z${rowIndex + 2})), 1, 0), 0), " ", "-"), ""),
                  IF(X${rowIndex + 2} <> "", SUBSTITUTE(B${rowIndex + 2} & "_" & C${rowIndex + 2} & "_" & X${rowIndex + 2} & "_" & 
                    IF(COUNTA(W${rowIndex + 2}:Z${rowIndex + 2}) > 0, QUOTIENT(T${rowIndex + 2}, COUNTA(W${rowIndex + 2}:Z${rowIndex + 2})) + IF(COLUMN(X${rowIndex + 2}) - COLUMN(W${rowIndex + 2}) < MOD(T${rowIndex + 2}, COUNTA(W${rowIndex + 2}:Z${rowIndex + 2})), 1, 0), 0), " ", "-"), ""),
                  IF(Y${rowIndex + 2} <> "", SUBSTITUTE(B${rowIndex + 2} & "_" & C${rowIndex + 2} & "_" & Y${rowIndex + 2} & "_" & 
                    IF(COUNTA(W${rowIndex + 2}:Z${rowIndex + 2}) > 0, QUOTIENT(T${rowIndex + 2}, COUNTA(W${rowIndex + 2}:Z${rowIndex + 2})) + IF(COLUMN(Y${rowIndex + 2}) - COLUMN(W${rowIndex + 2}) < MOD(T${rowIndex + 2}, COUNTA(W${rowIndex + 2}:Z${rowIndex + 2})), 1, 0), 0), " ", "-"), ""),
                  IF(Z${rowIndex + 2} <> "", SUBSTITUTE(B${rowIndex + 2} & "_" & C${rowIndex + 2} & "_" & Z${rowIndex + 2} & "_" & 
                    IF(COUNTA(W${rowIndex + 2}:Z${rowIndex + 2}) > 0, QUOTIENT(T${rowIndex + 2}, COUNTA(W${rowIndex + 2}:Z${rowIndex + 2})) + IF(COLUMN(Z${rowIndex + 2}) - COLUMN(W${rowIndex + 2}) < MOD(T${rowIndex + 2}, COUNTA(W${rowIndex + 2}:Z${rowIndex + 2})), 1, 0), 0), " ", "-"), "")
                )` } }] }],

              
              
              fields: "userEnteredValue.formulaValue",
            },
          });
        }

        if (areaColumnIndex) {
          requests.push({
            updateCells: {
              range: {
                sheetId: userSheet.properties.sheetId,
                startRowIndex: rowIndex +1 ,
                startColumnIndex: areaColumnIndex , // Adjust to the correct column where AREA is
                endRowIndex: rowIndex + 5,
                endColumnIndex: areaColumnIndex + 1, // Adjust the column range
              },
              rows: [{ values: [{ userEnteredValue: { formulaValue: `=2 * (N${rowIndex + 2} * M${rowIndex + 2} + M${rowIndex + 2} * O${rowIndex + 2} + O${rowIndex + 2} * N${rowIndex + 2})` } }] }],
              fields: "userEnteredValue.formulaValue",
            },
          });
        }

        if (variantGroupColumnIndex) {
          requests.push({
            updateCells: {
              range: {
                sheetId: userSheet.properties.sheetId,
                startRowIndex: rowIndex +1,
                startColumnIndex: variantGroupColumnIndex , // Adjust to the correct column where Variant Group is
                endRowIndex: rowIndex + 5,
                endColumnIndex: variantGroupColumnIndex + 1, // Adjust the column range
              },
              rows: [{ values: [{ userEnteredValue: { formulaValue: `=B${rowIndex + 2}` } }] }],
              fields: "userEnteredValue.formulaValue",
            },
          });
        }

        if (Object.keys(formatRequest).length > 0) {
          requests.push({
            updateCells: {
              range: {
                sheetId: userSheet.properties.sheetId,
                startRowIndex: rowIndex,
                startColumnIndex: colIndex,
                endRowIndex: rowIndex + 1,
                endColumnIndex: colIndex + 1,
              },
              rows: [{ values: [formatRequest] }], // To copy format to cells
              fields: Object.keys(formatRequest).join(","),
            },
          });
        }
      });
    });

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: userSheetId,
        requestBody: { requests },
      });
      console.log("Formatting and data validation copied successfully!");
    } else {
      console.log("No formatting or validation found to copy.");
    }

    return file.data;

  } catch (error) {
    console.error("Error:", error.message);
  }
}


async function createItemsSheet(drive, sheets, folderId, email, queryData, rackData) {
  try {
    console.log(`Creating a new items Google Sheet inside User's My Drive...`);
    console.log('rackdata : ', rackData);
    console.log('adminSheetItem', adminItemSheetId);
    

    // Step 1: Create a new Google Sheet in User's My Drive
    const fileMetadata = {
      name: `Items_${email}`,
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [folderId],
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id, webViewLink, owners",
    });

    if (!file || !file.data || !file.data.id) {
      console.error("File creation failed, no file data received.");
      return;
    }

    const userSheetId = file.data.id;
    console.log(`Sheet created successfully! ID: ${userSheetId}`);

    // Step 2: Get Admin Sheet Details
    console.log("Fetching Admin Sheet data...");
    console.log('adminSheets');
    const adminSheets = await sheets.spreadsheets.get({
      spreadsheetId: adminItemSheetId,
      includeGridData: true,
    });
    console.log(adminSheets);

    const adminSheet = adminSheets.data.sheets[0]; // Assuming first sheet
    const adminSheetName = adminSheet.properties.title;

    // Find the last non-empty row dynamically
    let lastRow = 0;
    let lastColumn = 0;
    let headerRow = []; // To store header names

    console.log(adminSheet);
    
    adminSheet.data[0].rowData.forEach((row, rowIndex) => {
      if (queryData && queryData?.length>0) {
        lastRow = queryData?.length + 1; // Last non-empty row
      }
      row.values?.forEach((cell, colIndex) => {
        if (cell.effectiveValue) {
          lastColumn = Math.max(lastColumn, colIndex + 1);
        }
        // Collect headers in the first row
        if (rowIndex === 0 && cell.effectiveValue) {
          headerRow.push(cell.effectiveValue);
        }
      });
    });

    console.log(`Item Sheet: ${lastRow} rows, ${lastColumn} columns`);

    // Convert column index to letter notation
    const get_Column_Letter = (colIndex) => {
      let letter = "";
      while (colIndex >= 0) {
        letter = String.fromCharCode((colIndex % 26) + 65) + letter;
        colIndex = Math.floor(colIndex / 26) - 1;
      }
      return letter;
    };

    const lastColumnLetter = get_Column_Letter(lastColumn - 1);
    const range = `${adminSheetName}!A1:${lastColumnLetter}${lastRow}`;
    console.log(`Fetching data from range: ${range}`);

    // Fetch data
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: adminItemSheetId,
      range: range,
    });

    const values = dataResponse.data.values || [];
    console.log("Data fetched successfully!");

    // Grant user permission
    await grantPermission(drive, email, userSheetId);

    // Get User Sheet details
    const userSheets = await sheets.spreadsheets.get({
      spreadsheetId: userSheetId,
    });
    const userSheet = userSheets.data.sheets[0]; // Assuming first sheet
    const userSheetName = userSheet.properties.title;

    // Step 3: Expand User Sheet Rows & Columns If Needed
    const updateRequests = [];

    if (lastColumn > userSheet.properties.gridProperties.columnCount) {
      console.log(
        `Expanding columns from ${userSheet.properties.gridProperties.columnCount} to ${lastColumn}...`
      );
      updateRequests.push({
        updateSheetProperties: {
          properties: {
            sheetId: userSheet.properties.sheetId,
            gridProperties: { columnCount: lastColumn },
          },
          fields: "gridProperties.columnCount",
        },
      });
    }

    if (lastRow > userSheet.properties.gridProperties.rowCount) {
      console.log(
        `Expanding rows from ${userSheet.properties.gridProperties.rowCount} to ${lastRow}...`
      );
      updateRequests.push({
        updateSheetProperties: {
          properties: {
            sheetId: userSheet.properties.sheetId,
            title: "Items",
            gridProperties: { rowCount: lastRow },
          },
          fields: "gridProperties.rowCount",
        },
      });
    }

    if (updateRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: userSheetId,
        requestBody: { requests: updateRequests },
      });
      console.log("Sheet expanded successfully!");
    }

    // Step 4: Copy Data from Admin Sheet to User Sheet
    if (values.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: userSheetId,
        range: `${userSheetName}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });
      console.log("Data copied successfully!");
    } else {
      console.log("No data found in Admin Sheet.");
    }

    // Step 5: Copy Formatting & Data Validation
    console.log("Copying formatting and data validation...");

    const requests = [];
    const lastRowIndex = lastRow; // Ensure this is dynamic, use lastRow

    const headers = headerRow.map((header) => header.stringValue || "");

    // Step 6: Apply formulas based on column headers
    const itemNoIndex = headers.indexOf("Item No");
    const productNameIndex = headers.indexOf("Product Name");
    const productIDIndex = headers.indexOf("Product ID");
    const itemIdIndex = headers.indexOf("Item ID");
    const noOfItemsIndex = headers.indexOf("No of Items");
    const maxProductQuantityIndex = headers.indexOf("Max Product Quantity");
    const weightOfItemKgsIndex = headers.indexOf("Weight of item kgs");
    const storageOccupiedIndex = headers.indexOf("Storage Occupied");
    const quantityInStockIndex = headers.indexOf("Quantity in stock");
    const maxItemQuantityIndex = headers.indexOf("Max Item Quantity");
    const itemAreaIndex = headers.indexOf("Item area");
    const sellingPriceIndex = headers.indexOf("Selling Price");
    const costPriceIndex = headers.indexOf("Cost Price");
    const itemPackageDimensionsIndex = headers.indexOf("ITEM ID Package Dimensions (max)");
    const numberOfRacksIndex = headers.indexOf("Number of Racks");
    const numberOfShelvesIndex = headers.indexOf("Number of Shelves");
    const lengthOfShelfIndex = headers.indexOf("Length of Shelf");
    const breadthOfShelfIndex = headers.indexOf("Breadth of Shelf");
    const heightOfShelfIndex = headers.indexOf("Height of Shelf");
    const skuIdIndex = headers.indexOf("SKU ID");

    // Loop through the rows and columns to apply dynamic formulas
    adminSheet.data[0].rowData.forEach((row, rowIndex) => {
      if (rowIndex >= lastRowIndex) return;
      if (!row.values) return;

      row.values.forEach((cell, colIndex) => {
        if (colIndex >= lastColumn) return;

        const formatRequest = {};
        if (cell.effectiveFormat) {
          formatRequest.userEnteredFormat = cell.effectiveFormat;
        }
        if (cell.dataValidation) {
          formatRequest.dataValidation = cell.dataValidation;
        }

        
        const filledRows = queryData.map((data, index) => {
          const row = Array(lastColumn).fill("");

          const getColumnLetter = (index) => {
            if (index < 26) {
              return String.fromCharCode(65 + index); // Single letter A-Z
            }
            const firstChar = String.fromCharCode(64 + Math.floor(index / 26));
            const secondChar = String.fromCharCode(65 + (index % 26));
            return `${firstChar}${secondChar}`;
          };
        
          if (productNameIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: productNameIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: productNameIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          stringValue: data.product_name || "",
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.stringValue",
              },
            });
          }

          if (productIDIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: productIDIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: productIDIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          stringValue: data.product_id || "",
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.stringValue",
              },
            });
          }
        
          if (itemIdIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: itemIdIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: itemIdIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          stringValue: data.iku_id || "",
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.stringValue",
              },
            });
          }
        
          if (noOfItemsIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: noOfItemsIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: noOfItemsIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: data.no_of_items || 0,
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }
        
          if (maxProductQuantityIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: maxProductQuantityIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: maxProductQuantityIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: data.max_quantity || 0,
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }
          if (weightOfItemKgsIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: weightOfItemKgsIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: weightOfItemKgsIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: parseFloat(data.product_weight_in_kg) || 0,
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }

          if (storageOccupiedIndex !== -1) {
            const itemPackageDimensionsCell = `${String.fromCharCode(65 + itemPackageDimensionsIndex)}${index + 2}`;
            const noOfItemsCell = `${String.fromCharCode(65 + noOfItemsIndex)}${index + 2}`;

            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: storageOccupiedIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: storageOccupiedIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          formulaValue: `=${itemPackageDimensionsCell} * ${noOfItemsCell}`,
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }

          if (quantityInStockIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: quantityInStockIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: quantityInStockIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: data.no_of_items || 0,
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }

          if (maxItemQuantityIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: maxItemQuantityIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: maxItemQuantityIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: data.max_quantity || 0,
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }
        
          if (sellingPriceIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: sellingPriceIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: sellingPriceIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: parseFloat(
                            (String(data.selling_price).split('$')?.[1] || '0').replace(/,/g, '')
                          )                    
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }

          if (costPriceIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: costPriceIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: costPriceIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: data.cost_price || 0,                        
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }
        
          if (itemPackageDimensionsIndex !== -1 && itemAreaIndex !== -1 && maxItemQuantityIndex !== -1) {
            const itemAreaCell = `${String.fromCharCode(65 + itemAreaIndex)}${index + 2}`;
            const maxItemQuantityCell = `${String.fromCharCode(65 + maxItemQuantityIndex)}${index + 2}`;

            
          
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: itemPackageDimensionsIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: itemPackageDimensionsIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          formulaValue: `=${itemAreaCell} * ${maxItemQuantityCell}`,
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.formulaValue",
              },
            });
          }
          

          if (skuIdIndex !== -1) {

            const maxItemQuantityCell = `${getColumnLetter(maxItemQuantityIndex)}${index + 2}`
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: skuIdIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: skuIdIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          formulaValue: `=LOWER(SUBSTITUTE(CONCATENATE(C${index + 2}, "_", "${data.category_name}", "_", "${data.brand}", "_", "${data.variations}", "_", ${data.variations}*${maxItemQuantityCell}), " ", "-"))`},
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.formulaValue",
              },
            });
          }


          if (numberOfRacksIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: numberOfRacksIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: numberOfRacksIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: parseInt(rackData.no_of_racks) || 0,
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }
          if (numberOfShelvesIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: numberOfShelvesIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: numberOfShelvesIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: parseInt(rackData.no_of_shelves) || 0,
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }
          if (lengthOfShelfIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: lengthOfShelfIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: lengthOfShelfIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: parseInt(rackData.shelf_length) || 0,
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }
          if (breadthOfShelfIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: breadthOfShelfIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: breadthOfShelfIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: parseInt(rackData.shelf_breadth) || 0,
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }
          if (heightOfShelfIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: heightOfShelfIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: heightOfShelfIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: parseInt(rackData.shelf_height) || 0,
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }

          if (itemAreaIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: itemAreaIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: itemAreaIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: data.area_size_lateral || 0
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }
        
          return row;
        });
        

        // Apply formulas based on column headers
        if (itemNoIndex !== -1) {
          requests.push({
            updateCells: {
              range: {
                sheetId: userSheet.properties.sheetId,
                startRowIndex: rowIndex + 1,
                startColumnIndex: itemNoIndex,
                endRowIndex: rowIndex + 2,
                endColumnIndex: itemNoIndex + 1,
              },
              rows: [
                {
                  values: [
                    {
                      userEnteredValue: {
                        formulaValue: `=IF(B${rowIndex + 2} <> "", ROW(A${rowIndex + 2}) - 1, "")`,
                      },
                    },
                  ],
                },
              ],
              fields: "userEnteredValue.formulaValue",
            },
          });
        }


        


        if (Object.keys(formatRequest).length > 0) {
          requests.push({
            updateCells: {
              range: {
                sheetId: userSheet.properties.sheetId,
                startRowIndex: rowIndex,
                startColumnIndex: colIndex,
                endRowIndex: rowIndex + 1,
                endColumnIndex: colIndex + 1,
              },
              rows: [{ values: [formatRequest] }],
              fields: Object.keys(formatRequest).join(","),
            },
          });
        }
      });
    });

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: userSheetId,
        requestBody: { requests },
      });
      console.log("Formatting and data validation copied successfully!");
    } else {
      console.log("No formatting or validation found to copy.");
    }

    return file.data;
  } catch (error) {
    console.error("Error:", error.message);
  }
}

async function createSKUSheet(drive, sheets, folderId, email, queryData, rackWallData) {
  try {
    console.log(`Creating a new sku Google Sheet inside User's My Drive...`);
    console.log('rackdata : ', rackWallData);
    

    // Step 1: Create a new Google Sheet in User's My Drive
    const fileMetadata = {
      name: `SKU_${email}`,
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [folderId],
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id, webViewLink, owners",
    });

    if (!file || !file.data || !file.data.id) {
      console.error("File creation failed, no file data received.");
      return;
    }

    const userSheetId = file.data.id;
    console.log(`Sheet created successfully! ID: ${userSheetId}`);

    // Step 2: Get Admin Sheet Details
    console.log("Fetching Admin Sheet data...");
    const adminSheets = await sheets.spreadsheets.get({
      spreadsheetId: adminSkuSheetId,
      includeGridData: true,
    });

    const adminSheet = adminSheets.data.sheets[0]; // Assuming first sheet
    const adminSheetName = adminSheet.properties.title;

    // Find the last non-empty row dynamically
    let lastRow = 0;
    let lastColumn = 0;
    let headerRow = []; // To store header names

    adminSheet.data[0].rowData.forEach((row, rowIndex) => {
      if (queryData && queryData.length>0) {
        lastRow = queryData.length + 1; // Last non-empty row
      }
      row.values?.forEach((cell, colIndex) => {
        if (cell.effectiveValue) {
          lastColumn = Math.max(lastColumn, colIndex + 1);
        }
        // Collect headers in the first row
        if (rowIndex === 0 && cell.effectiveValue) {
          headerRow.push(cell.effectiveValue);
        }
      });
    });

    console.log(`SKU Sheet: ${lastRow} rows, ${lastColumn} columns`);
    console.log(headerRow);

    // Convert column index to letter notation
    const get_Column_Letter = (colIndex) => {
      let letter = "";
      while (colIndex >= 0) {
        letter = String.fromCharCode((colIndex % 26) + 65) + letter;
        colIndex = Math.floor(colIndex / 26) - 1;
      }
      return letter;
    };

    const lastColumnLetter = get_Column_Letter(lastColumn - 1);
    const range = `${adminSheetName}!A1:${lastColumnLetter}${lastRow}`;
    console.log(`Fetching data from range: ${range}`);

    // Fetch data
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: adminSkuSheetId,
      range: range,
    });

    const values = dataResponse.data.values || [];
    console.log("Data fetched successfully!");

    // Grant user permission
    await grantPermission(drive, email, userSheetId);

    // Get User Sheet details
    const userSheets = await sheets.spreadsheets.get({
      spreadsheetId: userSheetId,
    });
    const userSheet = userSheets.data.sheets[0]; // Assuming first sheet
    const userSheetName = userSheet.properties.title;

    // Step 3: Expand User Sheet Rows & Columns If Needed
    const updateRequests = [];

    if (lastColumn > userSheet.properties.gridProperties.columnCount) {
      console.log(
        `Expanding columns from ${userSheet.properties.gridProperties.columnCount} to ${lastColumn}...`
      );
      updateRequests.push({
        updateSheetProperties: {
          properties: {
            sheetId: userSheet.properties.sheetId,
            gridProperties: { columnCount: lastColumn },
          },
          fields: "gridProperties.columnCount",
        },
      });
    }

    if (lastRow > userSheet.properties.gridProperties.rowCount) {
      console.log(
        `Expanding rows from ${userSheet.properties.gridProperties.rowCount} to ${lastRow}...`
      );
      updateRequests.push({
        updateSheetProperties: {
          properties: {
            sheetId: userSheet.properties.sheetId,
            title: "SKU",
            gridProperties: { rowCount: lastRow },
          },
          fields: "gridProperties.rowCount",
        },
      });
    }

    if (updateRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: userSheetId,
        requestBody: { requests: updateRequests },
      });
      console.log("Sheet expanded successfully!");
    }

    // Step 4: Copy Data from Admin Sheet to User Sheet
    if (values.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: userSheetId,
        range: `${userSheetName}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });
      console.log("Data copied successfully!");
    } else {
      console.log("No data found in Admin Sheet.");
    }

    // Step 5: Copy Formatting & Data Validation
    console.log("Copying formatting and data validation...");

    const requests = [];
    const lastRowIndex = lastRow; // Ensure this is dynamic, use lastRow

    const headers = headerRow.map((header) => header.stringValue || "");

    // Step 6: Apply formulas based on column headers
    const SNoIndex = headers.indexOf("S.No");
    const SKUIDIndex = headers.indexOf("SKU Code (SKU ID)");
    const productIDIndex = headers.indexOf("Product ID");
    const productNameIndex = headers.indexOf("Product Name");
    const categoryIndex = headers.indexOf("Category");
    const brandIndex = headers.indexOf("Brand or Manufacturer");
    const colorIndex = headers.indexOf("Color");
    const maxStockSizeIndex = headers.indexOf("Max Stock Size");
    const productTypeIndex = headers.indexOf("Product Type");
    const locationIndex = headers.indexOf("Location");
    const manufacturingDateIndex = headers.indexOf("Batch or Manufacturing Date (Optional)");
    const expiryDateIndex = headers.indexOf("End of Batch/Expiry Date (Optional)");
    const quantityIndex = headers.indexOf("Quantity");
    const weightIndex = headers.indexOf("Weight in kgs");
    const numberOfWallsOfRacksIndex = headers.indexOf("No of Walls of Rack(s)");
    const numberOfRacksInAWallIndex = headers.indexOf("No of Racks in a (Wall)");
    const stockLevelIndex = headers.indexOf("Stock Level");
    const lowStockIndex = headers.indexOf("Low Stock");
    const mediumStockIndex = headers.indexOf("Medium Stock");
    const highStockIndex = headers.indexOf("High Stock");
    const numberOfRacksIndex = headers.indexOf("Number of Racks");
    const numberOfShelvesIndex = headers.indexOf("Number of Shelves");
    const lengthOfShelfIndex = headers.indexOf("Length of Shelf");
    const breadthOfShelfIndex = headers.indexOf("Breadth of Shelf");
    const heightOfShelfIndex = headers.indexOf("Height of Shelf");
    const totalAreaOfShelfIndex = headers.indexOf("Total Area of Shelf");
    const totalShelfAreaInRackIndex = headers.indexOf("Total Shelf Area in Rack");
    const maxAreaOfStockIndex = headers.indexOf("Max Area of Stock");
    const totalShelvesIndex = headers.indexOf("Total Shelves");
    const maxRacksIndex = headers.indexOf("Max Racks");
    const extraShelvesIndex = headers.indexOf("Shelves extra");
    const itemsPerShelfIndex = headers.indexOf("Items Per Shelf");
    const maxRackIndex = headers.indexOf("Max Rack");
    const maxShelvesIndex = headers.indexOf("Max Shelves");
    const RKUIdIndex = headers.indexOf("RKU ID");

    // Loop through the rows and columns to apply dynamic formulas
    adminSheet.data[0].rowData.forEach((row, rowIndex) => {
      if (rowIndex >= lastRowIndex) return;
      if (!row.values) return;

      row.values.forEach((cell, colIndex) => {
        if (colIndex >= lastColumn) return;

        const formatRequest = {};
        if (cell.effectiveFormat) {
          formatRequest.userEnteredFormat = cell.effectiveFormat;
        }
        if (cell.dataValidation) {
          formatRequest.dataValidation = cell.dataValidation;
        }

        const filledRows = queryData.map((data, index) => {
          const row = Array(lastColumn).fill("");

          const getColumnLetter = (index) => {
            if (index < 26) {
              return String.fromCharCode(65 + index); // Single letter A-Z
            }
            const firstChar = String.fromCharCode(64 + Math.floor(index / 26));
            const secondChar = String.fromCharCode(65 + (index % 26));
            return `${firstChar}${secondChar}`;
          };

          
          const SKUID = data.sku_id || "";
          const skuParts = SKUID.split("_");

          const [
            pName,
            pCategory,
            pBrand,
          ] = skuParts;
        
          if (SKUIDIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: SKUIDIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: SKUIDIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          stringValue: SKUID || "",
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.stringValue",
              },
            });
          }

          if (productIDIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: productIDIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: productIDIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          stringValue: data.product_id || "",
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.stringValue",
              },
            });
          }

          if (productNameIndex !== -1) {

            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: productNameIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: productNameIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          stringValue: pName || "",
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.stringValue",
              },
            });
          }

          if (categoryIndex !== -1) {
          
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: categoryIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: categoryIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          stringValue: pCategory || "",
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.stringValue",
              },
            });
          }
        
          if (brandIndex !== -1) {
           
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: brandIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: brandIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          stringValue: pBrand || "",
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.stringValue",
              },
            });
          }
        
          if (colorIndex !== -1) {
           
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: colorIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: colorIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          stringValue: "",
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.stringValue",
              },
            });
          }

          if (maxStockSizeIndex !== -1) {
          
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: maxStockSizeIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: maxStockSizeIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue:
                          (parseInt(data.inventory_or_stock_quantity || 0) *
                            parseInt(data.variations || 0)) || 0,
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }

          if (productTypeIndex !== -1) {
          
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: productTypeIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: productTypeIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          stringValue: data.product_type || "",
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.stringValue",
              },
            });
          }

          if (locationIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: locationIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: locationIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          stringValue: rackWallData.store_location?.description || "",
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.stringValue",
              },
            });
          }
        
          if (manufacturingDateIndex !== -1) {
            const dateOnly = new Date(data.manufacturing_date);
            const dateSerial = (dateOnly - new Date("1899-12-30")) / (24 * 60 * 60 * 1000); // Convert to serial date
          
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: manufacturingDateIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: manufacturingDateIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: dateSerial, // Correct for date format
                        },
                        userEnteredFormat: {
                          numberFormat: {
                            type: "DATE",
                          },
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue, userEnteredFormat.numberFormat",
              },
            });
          }
          
          if (expiryDateIndex !== -1) {
            const dateOnly = new Date(data.expiry_date);
            const dateSerial = (dateOnly - new Date("1899-12-30")) / (24 * 60 * 60 * 1000);
          
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: expiryDateIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: expiryDateIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: dateSerial,
                        },
                        userEnteredFormat: {
                          numberFormat: {
                            type: "DATE",
                          },
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue, userEnteredFormat.numberFormat",
              },
            });
          }
          
          if (quantityIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: quantityIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: quantityIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: parseInt(data.inventory_or_stock_quantity) || 0,                        
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }

          if (weightIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: weightIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: weightIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: parseFloat(data.product_weight) || 0,                        
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }

          if (numberOfWallsOfRacksIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: numberOfWallsOfRacksIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: numberOfWallsOfRacksIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: parseInt(rackWallData.no_of_walls_of_rack) || 0,                        
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }

          if (numberOfRacksInAWallIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: numberOfRacksInAWallIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: numberOfRacksInAWallIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: parseInt(rackWallData.no_of_racks_per_wall) || 0,                        
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }

          if (stockLevelIndex !== -1) {
            const maxStockSizeCell = `${getColumnLetter(maxStockSizeIndex)}${index + 2}`;
            const quantityCell = `${getColumnLetter(quantityIndex)}${index + 2}`;
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: stockLevelIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: stockLevelIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          formulaValue: `=${quantityCell}/${maxStockSizeCell}*100` || 0,                        
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }

          if (lowStockIndex !== -1) {
            const stockLevelCell = `${getColumnLetter(stockLevelIndex)}${index + 2}`;

            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: lowStockIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: lowStockIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          formulaValue: `=(${stockLevelCell}<=30)` || 'N.A',                        
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.formulaValue",
              },
            });
          }

          if (mediumStockIndex !== -1) {
            const stockLevelCell = `${getColumnLetter(stockLevelIndex)}${index + 2}`;

            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: mediumStockIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: mediumStockIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          formulaValue: `=IF(AND(${stockLevelCell}>30, ${stockLevelCell}<80), TRUE, FALSE)` || 'N.A',                        
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.formulaValue",
              },
            });
          }

          if (highStockIndex !== -1) {
            const stockLevelCell = `${getColumnLetter(stockLevelIndex)}${index + 2}`;

            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: highStockIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: highStockIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          formulaValue: `=${stockLevelCell}>=80` || 'N.A',                        
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.formulaValue",
              },
            });
          }
          
          if (numberOfRacksIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: numberOfRacksIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: numberOfRacksIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: parseInt(data.no_of_racks) || 0,
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }

          if (numberOfShelvesIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: numberOfShelvesIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: numberOfShelvesIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: parseInt(data.no_of_shelves) || 0,
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }

          if (lengthOfShelfIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: lengthOfShelfIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: lengthOfShelfIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: parseFloat(data.shelf_length) || 0,
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }

          if (breadthOfShelfIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: breadthOfShelfIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: breadthOfShelfIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: parseFloat(data.shelf_breadth) || 0,
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }

          if (heightOfShelfIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: heightOfShelfIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: heightOfShelfIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          numberValue: parseFloat(data.shelf_height) || 0,
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.numberValue",
              },
            });
          }

          if (totalAreaOfShelfIndex !== -1) {
            const lengthOfShelfCell = `${getColumnLetter(lengthOfShelfIndex)}${index + 2}`;
            const breadthOfShelfCell = `${getColumnLetter(breadthOfShelfIndex) }${index + 2}`;
            const heightOfShelfCell = `${getColumnLetter(heightOfShelfIndex)}${index + 2}`;

            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: totalAreaOfShelfIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: totalAreaOfShelfIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          formulaValue: `=2 * (${lengthOfShelfCell} * ${breadthOfShelfCell} + ${breadthOfShelfCell} * ${heightOfShelfCell} + ${heightOfShelfCell} * ${lengthOfShelfCell})`
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.formulaValue",
              },
            });
          }

          if (totalShelfAreaInRackIndex !== -1) {
            const totalAreaOfShelfCell = `${ getColumnLetter(totalAreaOfShelfIndex)}${index + 2}`;
            
            const numberOfShelvesCell = `${getColumnLetter(numberOfShelvesIndex)}${index + 2}`;

            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: totalShelfAreaInRackIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: totalShelfAreaInRackIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          formulaValue: `=${totalAreaOfShelfCell}*${numberOfShelvesCell}`
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.formulaValue",
              },
            });
          }

          if (maxAreaOfStockIndex !== -1) {
            const maxStockSizeCell = `${getColumnLetter(maxStockSizeIndex) }${index + 2}`;

            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: maxAreaOfStockIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: maxAreaOfStockIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          formulaValue: `=${maxStockSizeCell}*${parseFloat(data.area_size_lateral)}`
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.formulaValue",
              },
            });
          }

          if (totalShelvesIndex !== -1) {
            const totalAreaOfShelfCell = `${getColumnLetter(totalAreaOfShelfIndex)}${index + 2}`;
            const maxAreaOfStockCell = `${getColumnLetter(maxAreaOfStockIndex)}${index + 2}`;

            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: totalShelvesIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: totalShelvesIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          formulaValue: `=${maxAreaOfStockCell}/${totalAreaOfShelfCell}`
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.formulaValue",
              },
            });
          }

          if (maxRacksIndex !== -1) {
            const totalShelvesCell = `${getColumnLetter(totalShelvesIndex)}${index + 2}`;
            const numberOfShelvesCell = `${getColumnLetter(numberOfShelvesIndex)}${index + 2}`;

            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: maxRacksIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: maxRacksIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          formulaValue: `=${totalShelvesCell}/${numberOfShelvesCell}`
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.formulaValue",
              },
            });
          }

          if (extraShelvesIndex !== -1) {
            const maxAreaOfStockCell = `${getColumnLetter(maxAreaOfStockIndex)}${index + 2}`;
            const totalShelfAreaInRackCell = `${getColumnLetter(totalShelfAreaInRackIndex)}${index + 2}`;

            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: extraShelvesIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: extraShelvesIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          formulaValue: `=ROUNDUP(${maxAreaOfStockCell}/${totalShelfAreaInRackCell})`
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.formulaValue",
              },
            });
          }

          if (itemsPerShelfIndex !== -1) {
            const totalAreaOfShelfCell = `${getColumnLetter(totalAreaOfShelfIndex)}${index + 2}`;

            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: itemsPerShelfIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: itemsPerShelfIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          formulaValue: `=ROUNDUP(${totalAreaOfShelfCell}/${parseFloat(data.area_size_lateral)})`
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.formulaValue",
              },
            });
          }

          if (maxRackIndex !== -1) {
            const totalShelvesCell = `${getColumnLetter(totalShelvesIndex)}${index + 2}`;

            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: maxRackIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: maxRackIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          formulaValue: `=ROUNDDOWN(${totalShelvesCell}/${parseFloat(data.area_size_lateral)})`
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.formulaValue",
              },
            });
          }

          if (maxShelvesIndex !== -1) {
            const maxStockSizeCell = `${getColumnLetter(maxStockSizeIndex)}${index + 2}`;
            const itemsPerShelfCell = `${getColumnLetter(itemsPerShelfIndex)}${index + 2}`;


            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: maxShelvesIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: maxShelvesIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          formulaValue: `=ROUNDUP(${maxStockSizeCell}/${itemsPerShelfCell})`
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.formulaValue",
              },
            });
          }

          if (RKUIdIndex !== -1) {
            const quantityCell = `${getColumnLetter(quantityIndex)}${index + 2}`;

            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: RKUIdIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: RKUIdIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          formulaValue: `=TEXTJOIN(",", TRUE, "${data.iku_id}", ${quantityCell})`
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.formulaValue",
              },
            });
          }

          return row;
        });
        

        // Apply formulas based on column headers
        if (SNoIndex !== -1) {
          requests.push({
            updateCells: {
              range: {
                sheetId: userSheet.properties.sheetId,
                startRowIndex: rowIndex + 1,
                startColumnIndex: SNoIndex,
                endRowIndex: rowIndex + 2,
                endColumnIndex: SNoIndex + 1,
              },
              rows: [
                {
                  values: [
                    {
                      userEnteredValue: {
                        formulaValue: `=IF(B${rowIndex + 2} <> "", ROW(A${rowIndex + 2}) - 1, "")`,
                      },
                    },
                  ],
                },
              ],
              fields: "userEnteredValue.formulaValue",
            },
          });
        }
        if (Object.keys(formatRequest).length > 0) {
          requests.push({
            updateCells: {
              range: {
                sheetId: userSheet.properties.sheetId,
                startRowIndex: rowIndex,
                startColumnIndex: colIndex,
                endRowIndex: rowIndex + 1,
                endColumnIndex: colIndex + 1,
              },
              rows: [{ values: [formatRequest] }],
              fields: Object.keys(formatRequest).join(","),
            },
          });
        }
      });
    });

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: userSheetId,
        requestBody: { requests },
      });
      console.log("Formatting and data validation copied successfully!");
    } else {
      console.log("No formatting or validation found to copy.");
    }

    return file.data;
  } catch (error) {
    console.error("Error:", error.message);
  }
}


async function createRKUSheet(drive, sheets, folderId, email, queryData) {
  try {
    console.log(`Creating a new rku Google Sheet inside User's My Drive...`);

    // Step 1: Create a new Google Sheet in User's My Drive
    const fileMetadata = {
      name: `RKU_${email}`,
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [folderId],
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id, webViewLink, owners",
    });

    if (!file || !file.data || !file.data.id) {
      console.error("File creation failed, no file data received.");
      return;
    }

    const userSheetId = file.data.id;
    console.log(`Sheet created successfully! ID: ${userSheetId}`);

    // Step 2: Get Admin Sheet Details
    console.log("Fetching Admin Sheet data...");
    const adminSheets = await sheets.spreadsheets.get({
      spreadsheetId: adminRkuSheetId,
      includeGridData: true,
    });

    const adminSheet = adminSheets.data.sheets[0]; // Assuming first sheet
    const adminSheetName = adminSheet.properties.title;

    // Find the last non-empty row dynamically
    let lastRow = 0;
    let lastColumn = 0;
    let headerRow = []; // To store header names

    adminSheet.data[0].rowData.forEach((row, rowIndex) => {
      if (queryData && queryData.length>0) {
        lastRow = queryData.length + 1; // Last non-empty row
      }
      row.values?.forEach((cell, colIndex) => {
        if (cell.effectiveValue) {
          lastColumn = Math.max(lastColumn, colIndex + 1);
        }
        // Collect headers in the first row
        if (rowIndex === 0 && cell.effectiveValue) {
          headerRow.push(cell.effectiveValue);
        }
      });
    });

    console.log(`RKU Sheet: ${lastRow} rows, ${lastColumn} columns`);
    console.log(headerRow);

    // Convert column index to letter notation
    const get_Column_Letter = (colIndex) => {
      let letter = "";
      while (colIndex >= 0) {
        letter = String.fromCharCode((colIndex % 26) + 65) + letter;
        colIndex = Math.floor(colIndex / 26) - 1;
      }
      return letter;
    };

    const lastColumnLetter = get_Column_Letter(lastColumn - 1);
    const range = `${adminSheetName}!A1:${lastColumnLetter}${lastRow}`;
    console.log(`Fetching data from range: ${range}`);

    // Fetch data
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: adminRkuSheetId,
      range: range,
    });

    const values = dataResponse.data.values || [];
    console.log("Data fetched successfully!");

    // Grant user permission
    await grantPermission(drive, email, userSheetId);

    // Get User Sheet details
    const userSheets = await sheets.spreadsheets.get({
      spreadsheetId: userSheetId,
    });
    const userSheet = userSheets.data.sheets[0]; // Assuming first sheet
    const userSheetName = userSheet.properties.title;

    // Step 3: Expand User Sheet Rows & Columns If Needed
    const updateRequests = [];

    if (lastColumn > userSheet.properties.gridProperties.columnCount) {
      console.log(
        `Expanding columns from ${userSheet.properties.gridProperties.columnCount} to ${lastColumn}...`
      );
      updateRequests.push({
        updateSheetProperties: {
          properties: {
            sheetId: userSheet.properties.sheetId,
            gridProperties: { columnCount: lastColumn },
          },
          fields: "gridProperties.columnCount",
        },
      });
    }

    if (lastRow > userSheet.properties.gridProperties.rowCount) {
      console.log(
        `Expanding rows from ${userSheet.properties.gridProperties.rowCount} to ${lastRow}...`
      );
      updateRequests.push({
        updateSheetProperties: {
          properties: {
            sheetId: userSheet.properties.sheetId,
            title: "RKU",
            gridProperties: { rowCount: lastRow },
          },
          fields: "gridProperties.rowCount",
        },
      });
    }

    if (updateRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: userSheetId,
        requestBody: { requests: updateRequests },
      });
      console.log("Sheet expanded successfully!");
    }

    // Step 4: Copy Data from Admin Sheet to User Sheet
    if (values.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: userSheetId,
        range: `${userSheetName}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });
      console.log("Data copied successfully!");
    } else {
      console.log("No data found in Admin Sheet.");
    }

    // Step 5: Copy Formatting & Data Validation
    console.log("Copying formatting and data validation...");

    const requests = [];
    const lastRowIndex = lastRow; // Ensure this is dynamic, use lastRow

    const headers = headerRow.map((header) => header.stringValue || "");

    // Step 6: Apply formulas based on column headers
    const SNoIndex = headers.indexOf("S.No");
    const RKUIDIndex = headers.indexOf("RKU ID");

    // Loop through the rows and columns to apply dynamic formulas
    adminSheet.data[0].rowData.forEach((row, rowIndex) => {
      if (rowIndex >= lastRowIndex) return;
      if (!row.values) return;

      row.values.forEach((cell, colIndex) => {
        if (colIndex >= lastColumn) return;

        const formatRequest = {};
        if (cell.effectiveFormat) {
          formatRequest.userEnteredFormat = cell.effectiveFormat;
        }
        if (cell.dataValidation) {
          formatRequest.dataValidation = cell.dataValidation;
        }

        const filledRows = queryData.map((data, index) => {
          const row = Array(lastColumn).fill("");

          const getColumnLetter = (index) => {
            if (index < 26) {
              return String.fromCharCode(65 + index); // Single letter A-Z
            }
            const firstChar = String.fromCharCode(64 + Math.floor(index / 26));
            const secondChar = String.fromCharCode(65 + (index % 26));
            return `${firstChar}${secondChar}`;
          };

        
          if (RKUIDIndex !== -1) {
            requests.push({
              updateCells: {
                range: {
                  sheetId: userSheet.properties.sheetId,
                  startRowIndex: index + 1,
                  startColumnIndex: RKUIDIndex,
                  endRowIndex: index + 2,
                  endColumnIndex: RKUIDIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          stringValue: data.rku_id || "",
                        },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue.stringValue",
              },
            });
          }


          return row;
        });
        

        // Apply formulas based on column headers
        if (SNoIndex !== -1) {
          requests.push({
            updateCells: {
              range: {
                sheetId: userSheet.properties.sheetId,
                startRowIndex: rowIndex + 1,
                startColumnIndex: SNoIndex,
                endRowIndex: rowIndex + 2,
                endColumnIndex: SNoIndex + 1,
              },
              rows: [
                {
                  values: [
                    {
                      userEnteredValue: {
                        formulaValue: `=IF(B${rowIndex + 2} <> "", ROW(A${rowIndex + 2}) - 1, "")`,
                      },
                    },
                  ],
                },
              ],
              fields: "userEnteredValue.formulaValue",
            },
          });
        }
        if (Object.keys(formatRequest).length > 0) {
          requests.push({
            updateCells: {
              range: {
                sheetId: userSheet.properties.sheetId,
                startRowIndex: rowIndex,
                startColumnIndex: colIndex,
                endRowIndex: rowIndex + 1,
                endColumnIndex: colIndex + 1,
              },
              rows: [{ values: [formatRequest] }],
              fields: Object.keys(formatRequest).join(","),
            },
          });
        }
      });
    });

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: userSheetId,
        requestBody: { requests },
      });
      console.log("Formatting and data validation copied successfully!");
    } else {
      console.log("No formatting or validation found to copy.");
    }

    return file.data;
  } catch (error) {
    console.error("Error:", error.message);
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

    console.log(`Permissions granted to ${email} and ${SERVICE_ACCOUNT_EMAIL}`);
  } catch (error) {
    throw new Error("Failed to grant permission.");
  }
}


async function removeFirstSheet(sheets, spreadsheetId) {
  try {
    // Fetch spreadsheet details
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });

    // Find the "Products" sheet
    const sheet = spreadsheet.data.sheets.find(
      (s) => s.properties.title === "Sheet1"
    );

    if (!sheet) {
      console.log("No sheet named 'Sheet1' found. Skipping deletion.");
      return;
    }

    // Delete the "Products" sheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ deleteSheet: { sheetId: sheet.properties.sheetId } }],
      },
    });

    console.log(`'Sheet1' sheet removed successfully.`);
  } catch (error) {
    console.error("Error removing 'Sheet1' sheet:", error.message);
    throw new Error("Failed to remove 'Sheet1' sheet.");
  }
}


async function addSheetToFile(sheets, fileId, categoryName, email, drive, oAuth2Client) {
  try {
    // Step 1: Validate the fileId
    if (!fileId) {
      throw new Error("Invalid fileId. Cannot proceed with duplicating the sheet.");
    }

    console.log("Destination Spreadsheet ID:", fileId);

    // Step 2: Fetch spreadsheet details
    const fileData = await sheets.spreadsheets.get({
      spreadsheetId: fileId,
    });

    // Step 3: Get sheet data and check if the spreadsheet has any sheets
    const sheetData = fileData.data.sheets;
    if (!sheetData || sheetData.length === 0) {
      throw new Error("No sheets found in the spreadsheet.");
    }

    // Step 4: Find the first sheet (Sheet1)
    const firstSheet = sheetData.find(sheet => sheet.properties.title === 'Sheet1');
    if (!firstSheet) {
      throw new Error("Sheet1 not found.");
    }

    // Step 5: Get the sheetId of 'Sheet1'
    const firstSheetId = firstSheet.properties.sheetId;
    console.log("Found Sheet1 with sheetId:", firstSheetId);

    // Step 6: Duplicate Sheet1
    const addSheetResponse = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: fileId,
      requestBody: {
        requests: [
          {
            duplicateSheet: {
              sourceSheetId: firstSheetId,  
              newSheetName: categoryName,  
            },
          },
        ],
      },
    });

    // Step 7: Confirm new sheet creation and get its ID
    const updatedFileData = await sheets.spreadsheets.get({ spreadsheetId: fileId });
    const newSheet = updatedFileData.data.sheets.find(sheet => sheet.properties.title === categoryName);

    if (!newSheet) {
      throw new Error(`Failed to confirm creation of sheet: ${categoryName}`);
    }

    console.log(`Sheet1 duplicated successfully as "${categoryName}".`);

    // Step 8: Now apply protection
    // await deployAppsScript(oAuth2Client,  fileId, serviceAccountEmail);
    // await deployAppsScript(sheets,  fileId, serviceAccountEmail, email, drive);
    console.log(`Header and first column protected for "${categoryName}".`);

  } catch (error) {
    console.error(`Error duplicating Sheet1:`, error.message);
    console.error(error);
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

    const auth = new google.auth.JWT(
      process.env.GCP_CLIENT_EMAIL,
      null,
      process.env.GCP_PRIVATE_KEY.replace(/\\n/g, "\n"), // Fix multi-line issue
      [
        "https://www.googleapis.com/auth/spreadsheets", 
        "https://www.googleapis.com/auth/drive.file", // Ensure correct scope
        "https://www.googleapis.com/auth/drive" // Ensure correct scope
      ]
    );

    const drive = google.drive({ version: "v3", auth: oAuth2Client });
    const sheets = google.sheets({ version: "v4", auth: auth });
    const sheet2 = google.sheets({ version: "v4", auth: oAuth2Client });

    // Step 1: Get or create base folder
    const folderId = await getBaseFolder(drive, email);

    // Step 2: Create sub-folders & store their IDs
    const serviceAccountEmail = process.env.GCP_CLIENT_EMAIL;
    const subFolderIds = await createSubFolders(drive, folderId, serviceAccountEmail);


    // Step 3: Check if file exists, else create it
    let file = await getProductsFile(drive, folderId, email);
    if (!file) file = await copyAdminSheet(drive, sheets, folderId, email);

    // Step 4: Add new category sheets
    for (const category of category_names) {
      await addSheetToFile(sheets, file.id, category, email, drive, oAuth2Client);
    }

    await removeFirstSheet(sheets, file.id);

    await grantPermission(drive, email, file.id);

    return { success: true, url: `https://docs.google.com/spreadsheets/d/${file.id}/edit` };
  } catch (error) {
    console.error("Error processing Drive:", error.message);
    return { success: false, message: error.message };
  }
}

async function createItemCsv(email, shop_no, rackData) {
  try {
    const result = await ambarsariyaPool.query(
      `SELECT
          p.shop_no,
          p.product_name,
          p.product_id,
          p.product_type,
          iku_value AS iku_id,
          split_part(iku_value, '_', 4)::int AS no_of_items,
          p.inventory_or_stock_quantity AS max_quantity,
          p.area_size_lateral,
          p.product_weight_in_kg,
          p.selling_price,
          p.price AS cost_price,
          p.brand,
          c.category_name,
          array_length(
              array_remove(
                  ARRAY[
                      CASE WHEN p.variation_1 IS NOT NULL AND p.variation_1 != '' THEN 1 ELSE NULL END,
                      CASE WHEN p.variation_2 IS NOT NULL AND p.variation_2 != '' THEN 1 ELSE NULL END,
                      CASE WHEN p.variation_3 IS NOT NULL AND p.variation_3 != '' THEN 1 ELSE NULL END,
                      CASE WHEN p.variation_4 IS NOT NULL AND p.variation_4 != '' THEN 1 ELSE NULL END
                  ], NULL
              ), 1
          ) AS variations,
          e.oauth_access_token,
          e.oauth_refresh_token
      FROM
          sell.products p
      JOIN
          sell.eshop_form e
      ON
          p.shop_no = e.shop_no
      JOIN
          categories c
      ON
          p.category = c.category_id
      JOIN
          LATERAL unnest(p.iku_id) AS iku_value
      ON 
        true
      WHERE
          p.shop_no = $1
      ORDER BY
          p.product_id, no_of_items;`,
      [shop_no]
    );

    if (!result.rowCount) throw new Error("User not authenticated.");

    const { oauth_access_token, oauth_refresh_token, category_names } = result.rows[0];

    oAuth2Client.setCredentials({
      access_token: oauth_access_token,
      refresh_token: oauth_refresh_token,
    });

    const auth = new google.auth.JWT(
      process.env.GCP_CLIENT_EMAIL,
      null,
      process.env.GCP_PRIVATE_KEY.replace(/\\n/g, "\n"), // Fix multi-line issue
      [
        "https://www.googleapis.com/auth/spreadsheets", 
        "https://www.googleapis.com/auth/drive.file", // Ensure correct scope
        "https://www.googleapis.com/auth/drive" // Ensure correct scope
      ]
    );

    const drive = google.drive({ version: "v3", auth: oAuth2Client });
    const sheets = google.sheets({ version: "v4", auth: auth });
    const sheet2 = google.sheets({ version: "v4", auth: oAuth2Client });

    // Step 1: Get or create base folder
    const folderId = await getBaseFolder(drive, email);

    // Step 3: Check if file exists, else create it
    let file = await getItemsFile(drive, folderId, email);
    if (!file) file = await createItemsSheet(drive, sheets,folderId, email,result.rows, rackData);

    await grantPermission(drive, email, file.id);

    return { success: true, url: `https://docs.google.com/spreadsheets/d/${file.id}/edit` };
  } catch (error) {
    console.error("Error processing Drive:", error.message);
    return { success: false, message: error.message };
  }
}

async function createSKUCsv(email, shop_no, rackWallData) {
  try {
    const result = await ambarsariyaPool.query(
      `SELECT 
          p.product_name,
          p.product_id,
          p.product_type,
          p.iku_id,
          i.sku_id, 
          p.product_weight_in_kg AS product_weight,
          i.no_of_racks, 
          i.no_of_shelves,  
          i.shelf_length, 
          i.shelf_breadth, 
          i.shelf_height, 
          p.manufacturing_date,
          p.expiry_date,
          p.inventory_or_stock_quantity,
          p.area_size_lateral,
          -- Count of non-null variations
          array_length(
              array_remove(
                  ARRAY[
                      CASE WHEN p.variation_1 IS NOT NULL AND p.variation_1 != '' THEN 1 ELSE NULL END,
                      CASE WHEN p.variation_2 IS NOT NULL AND p.variation_2 != '' THEN 1 ELSE NULL END,
                      CASE WHEN p.variation_3 IS NOT NULL AND p.variation_3 != '' THEN 1 ELSE NULL END,
                      CASE WHEN p.variation_4 IS NOT NULL AND p.variation_4 != '' THEN 1 ELSE NULL END
                  ], 
                  NULL
              ), 
              1
          ) AS variations,
          e.oauth_access_token,
          e.oauth_refresh_token
      FROM 
          sell.items i
      JOIN 
          sell.products p 
          ON p.shop_no = i.shop_no AND p.product_id = i.product_id
      JOIN 
          sell.eshop_form e 
          ON e.shop_no = i.shop_no
      WHERE 
          i.shop_no = $1
      GROUP BY 
          p.product_name, p.product_id, p.product_type,p.iku_id, i.sku_id, p.product_weight_in_kg, i.no_of_racks, 
          i.no_of_shelves, i.shelf_length, i.shelf_breadth, 
          i.shelf_height, p.manufacturing_date, p.expiry_date, 
          p.inventory_or_stock_quantity, p.area_size_lateral,
          p.variation_1, p.variation_2, p.variation_3, p.variation_4,
          e.oauth_access_token, e.oauth_refresh_token
      ORDER BY 
          i.sku_id;
      `,
      [shop_no]
    );

    if (!result.rowCount) throw new Error("User not authenticated.");

    const { oauth_access_token, oauth_refresh_token } = result.rows[0];

    oAuth2Client.setCredentials({
      access_token: oauth_access_token,
      refresh_token: oauth_refresh_token,
    });

    const auth = new google.auth.JWT(
      process.env.GCP_CLIENT_EMAIL,
      null,
      process.env.GCP_PRIVATE_KEY.replace(/\\n/g, "\n"), // Fix multi-line issue
      [
        "https://www.googleapis.com/auth/spreadsheets", 
        "https://www.googleapis.com/auth/drive.file", // Ensure correct scope
        "https://www.googleapis.com/auth/drive" // Ensure correct scope
      ]
    );

    const drive = google.drive({ version: "v3", auth: oAuth2Client });
    const sheets = google.sheets({ version: "v4", auth: auth });
    const sheet2 = google.sheets({ version: "v4", auth: oAuth2Client });

    // Step 1: Get or create base folder
    const folderId = await getBaseFolder(drive, email);

    // Step 3: Check if file exists, else create it
    let file = await getSKUFile(drive, folderId, email);
    if (!file) file = await createSKUSheet(drive, sheets,folderId, email,result.rows, rackWallData);

    await grantPermission(drive, email, file.id);

    return { success: true, url: `https://docs.google.com/spreadsheets/d/${file.id}/edit` };
  } catch (error) {
    console.error("Error processing Drive:", error.message);
    return { success: false, message: error.message };
  }
}


async function createRKUCsv(email, shop_no) {
  try {
    const result = await ambarsariyaPool.query(
      `SELECT
          rku AS rku_id,
          s.total_area_of_shelf ,
          p.area_size_lateral ,
          e.oauth_access_token,
          e.oauth_refresh_token
      FROM
          sell.sku s
      JOIN
          sell.products p ON p.shop_no = s.shop_no AND p.product_id = s.product_id
      JOIN 
            sell.eshop_form e 
            ON e.shop_no = s.shop_no,
          unnest(s.rku_id) WITH ORDINALITY AS rku (rku, idx)
      WHERE
          s.shop_no = $1
          AND s.rku_id IS NOT NULL
          AND idx < array_length(s.rku_id, 1)
      `,
      [shop_no]
    );

    if (!result.rowCount) throw new Error("User not authenticated.");

    const { oauth_access_token, oauth_refresh_token } = result.rows[0];

    oAuth2Client.setCredentials({
      access_token: oauth_access_token,
      refresh_token: oauth_refresh_token,
    });

    const auth = new google.auth.JWT(
      process.env.GCP_CLIENT_EMAIL,
      null,
      process.env.GCP_PRIVATE_KEY.replace(/\\n/g, "\n"), // Fix multi-line issue
      [
        "https://www.googleapis.com/auth/spreadsheets", 
        "https://www.googleapis.com/auth/drive.file", // Ensure correct scope
        "https://www.googleapis.com/auth/drive" // Ensure correct scope
      ]
    );

    const drive = google.drive({ version: "v3", auth: oAuth2Client });
    const sheets = google.sheets({ version: "v4", auth: auth });
    const sheet2 = google.sheets({ version: "v4", auth: oAuth2Client });

    // Step 1: Get or create base folder
    const folderId = await getBaseFolder(drive, email);

    // Step 3: Check if file exists, else create it
    let file = await getRKUFile(drive, folderId, email);
    if (!file) file = await createRKUSheet(drive, sheets,folderId, email,result.rows);

    await grantPermission(drive, email, file.id);

    return { success: true, url: `https://docs.google.com/spreadsheets/d/${file.id}/edit` };
  } catch (error) {
    console.error("Error processing Drive:", error.message);
    return { success: false, message: error.message };
  }
}

module.exports = { processDrive, createItemCsv, createSKUCsv, createRKUCsv };
