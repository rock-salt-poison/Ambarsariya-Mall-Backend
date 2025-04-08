// /index.js
const express = require('express');
const app = express();
const http = require('http');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
require('./controllers/CRONJob');

// Import WebSocket functions
const { initializeWebSocket } = require('./webSocket');

// Import routes
const ambarsariyaRoutes = require('./routes/AmbarsariyaMall_Routes');
const adminRoutes = require('./routes/AdminRoutes');
const driveRoutes = require('./routes/DriveRoutes');
const photosRoutes = require('./routes/GooglePhotos_Routes');

// Middleware to parse incoming JSON requests
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000', // Allow only your frontend URL
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'], // Allow methods including PATCH
}));
app.use('/notice_images', express.static(path.join(__dirname, 'notice_images')));

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Use routes for each database
app.use('/api/ambarsariya', ambarsariyaRoutes);
app.use('/admin/api', adminRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/google-photo', photosRoutes);

// Create HTTP server and integrate it with Socket.IO
const server = http.createServer(app);
initializeWebSocket(server);   // Attach the Socket.IO server to the HTTP server

// Start the server
server.listen(process.env.PORT || 4000, () => {
  console.log(`Server running on port ${process.env.PORT || 4000}`);
});

// Use a custom error handler
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File size exceeds the 1MB limit." });
    }
  }
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

// Set server keep-alive settings
server.keepAliveTimeout = 120 * 1000; // 120 seconds
server.headersTimeout = 125 * 1000;
