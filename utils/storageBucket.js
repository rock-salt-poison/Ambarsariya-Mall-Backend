const { Storage } = require("@google-cloud/storage");
require('dotenv').config();

const storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID,
    credentials: {
      private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.GCP_CLIENT_EMAIL,
    },
  }); // Uses GOOGLE_APPLICATION_CREDENTIALS environment variable
const bucketName = "ambarsariya-emall"; // Replace with your actual bucket name

/**
 * Uploads a file to Google Cloud Storage.
 * @param {Object} file - The file object from Multer (req.file).
 * @param {string} folderName - The folder inside the bucket where the file should be uploaded.
 * @returns {Promise<string>} - The public URL of the uploaded file.
 */
const uploadFileToGCS = (file, folderName = "default-folder") => {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);

    const sanitizeFileName = (fileName) => {
      return fileName.replace(/\s+/g, "_"); // Replaces spaces with underscores
    };

    const gcsFileName = `${folderName}/${Date.now()}-${sanitizeFileName(file.originalname)}`;
    const blob = storage.bucket(bucketName).file(gcsFileName);
    const blobStream = blob.createWriteStream({
      resumable: false,
      public: true, // Make the file publicly accessible
    });

    blobStream.on("error", (err) => {
      console.error("Error uploading file to GCS:", err);
      reject(err);
    });

    blobStream.on("finish", () => {
      const uploadedFileUrl = `https://storage.googleapis.com/${bucketName}/${gcsFileName}`;
      resolve(uploadedFileUrl);
    });

    blobStream.end(file.buffer);
  });
};

module.exports = { uploadFileToGCS };
