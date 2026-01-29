// /index.js
const express = require('express');
const app = express();
const http = require('http');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
// require('./controllers/CRONJob');

// Import WebSocket functions
const { initializeWebSocket } = require('./webSocket');

// Import Banner Scheduler
const bannerScheduler = require('./services/BannerScheduler');

// Import routes
const ambarsariyaRoutes = require('./routes/AmbarsariyaMall_Routes');
const adminRoutes = require('./routes/AdminRoutes');
const driveRoutes = require('./routes/DriveRoutes');
const paymentRoutes = require('./routes/PaymentRoutes');
const photosRoutes = require('./routes/GooglePhotos_Routes');
const serveRoutes = require('./routes/ServeRoutes');
const adminRolesRoutes = require('./routes/AdminRolesRoutes');

// Middleware to parse incoming JSON requests
app.use(cors({
  // origin: '*', 
  origin: ["https://www.ambarsariyamall.shop",
    "https://ambarsariyamall.shop",
   "http://localhost:3002",
  "https://ambarsariyamall.com",
"https://ambarsariyamall.com" ],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'], // Allow methods including PATCH
  credentials: true
}));
app.use(express.json());
app.use('/notice_images', express.static(path.join(__dirname, 'notice_images')));

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Use routes for each database
app.use('/api/ambarsariya', ambarsariyaRoutes);
app.use('/admin/api', adminRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/google-photo', photosRoutes);
app.use('/api/ambarsariya/serve', serveRoutes);
app.use('/admin/roles', adminRolesRoutes);

// Create HTTP server and integrate it with Socket.IO
const server = http.createServer(app);
initializeWebSocket(server);   // Attach the Socket.IO server to the HTTP server

// Start the server
server.listen(process.env.PORT || 4000, async () => {
  console.log(`Server running on port ${process.env.PORT || 4000}`);
  
  // Initialize banner scheduler and load existing future banners
  try {
    console.log('[Server] Initializing banner notification scheduler...');
    await bannerScheduler.loadAndRescheduleBanners();
    console.log('[Server] Banner notification scheduler initialized');
  } catch (error) {
    console.error('[Server] Error initializing banner scheduler:', error);
  }
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