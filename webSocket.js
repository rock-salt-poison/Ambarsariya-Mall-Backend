// /webSocket.js
const socketIo = require('socket.io');

let io;

const initializeWebSocket = (server) => {
  // Initialize socket.io with the server
  io = socketIo(server);

  // When a client connects
  io.on('connection', (socket) => {
    console.log('A client connected');
    
    // Send a welcome message to the newly connected client
    socket.emit('message', 'Welcome to the WebSocket server!');
    
    // Handle when a client disconnects
    socket.on('disconnect', () => {
      console.log('A client disconnected');
    });
  });
};

const broadcastMessage = (message) => {
  if (io) {
    io.emit('message', message); // Broadcast message to all connected clients
  } else {
    console.log('Socket.io not initialized');
  }
};

module.exports = { initializeWebSocket, broadcastMessage };
