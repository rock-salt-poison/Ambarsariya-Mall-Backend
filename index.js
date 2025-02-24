// /index.js
const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');
const multer = require('multer'); 


const ambarsariyaRoutes = require('./routes/AmbarsariyaMall_Routes');
const adminRoutes = require('./routes/AdminRoutes');
const driveRoutes = require('./routes/DriveRoutes');
const photosRoutes = require('./routes/GooglePhotos_Routes');

// Middleware to parse incoming JSON requests
app.use(express.json());
app.use(cors());

app.use('/notice_images', express.static(path.join(__dirname, 'notice_images')));

// Use routes for each database
app.use('/api/ambarsariya', ambarsariyaRoutes);
app.use('/admin/api', adminRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/google-photo', photosRoutes);

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File size exceeds the 1MB limit." });
    }
  }
  res.status(500).json({ error: err.message || "Internal Server Error" });
});


// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
