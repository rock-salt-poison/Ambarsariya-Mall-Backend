// /index.js
const express = require('express');
const app = express();
const cors = require('cors');

const ambarsariyaRoutes = require('./routes/AmbarsariyaMall_Routes');
const adminRoutes = require('./routes/AdminRoutes');

// Middleware to parse incoming JSON requests
app.use(express.json());
app.use(cors());

// Use routes for each database
app.use('/api/ambarsariya', ambarsariyaRoutes);
app.use('/admin/api', adminRoutes);

// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
