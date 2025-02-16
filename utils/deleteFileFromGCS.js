const { Storage } = require("@google-cloud/storage");
require("dotenv").config();

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: {
    private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.GCP_CLIENT_EMAIL,
  },
});

const bucketName = "ambarsariya-emall"; // Replace with your actual bucket name
const bucket = storage.bucket(bucketName);

/**
 * Deletes a file from a specified folder in Google Cloud Storage.
 * @param {string} fileUrl - The full public URL of the file to delete.
 * @returns {Promise<void>}
 */
const deleteFileFromGCS = async (fileUrl) => {
  try {
    if (!fileUrl) {
      console.log("⚠️ No file URL provided, skipping deletion.");
      return;
    }

    // Extract file path (folderName/filename) from the file URL
    const filePath = fileUrl.replace(`https://storage.googleapis.com/${bucketName}/`, "");

    // Ensure we got a valid path
    if (!filePath.includes("/")) {
      console.log("⚠️ Invalid file path, skipping deletion:", filePath);
      return;
    }

    // Reference the file inside the folder
    const file = bucket.file(filePath);

    // Delete the file
    await file.delete();
    console.log(`✅ File deleted from GCS: ${filePath}`);
  } catch (err) {
    console.error("❌ Error deleting file from GCS:", err);
    throw new Error("Failed to delete file from Google Cloud Storage");
  }
};

module.exports = { deleteFileFromGCS };
