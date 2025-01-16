const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Define the directory where uploaded files will be stored
const uploadDir = path.join(__dirname, '../notice_images');

// Ensure that the directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Define storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // Save files in 'notice_images' folder
  },
  filename: (req, file, cb) => {
    // Generate a unique filename
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

// Initialize multer with the storage configuration
const UploadFiles = multer({ storage });

module.exports = UploadFiles;
