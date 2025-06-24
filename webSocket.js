const socketIo = require('socket.io');

let io;

const initializeWebSocket = (server) => {
  io = socketIo(server, {
    path: "/socket.io",
    cors: {
      // origin: '*', 
      origin: ['https://ambarsariyamall.shop', 
        'https://ambarsariyamall.com', 
        
        'http://localhost:3000', 
        // 'http://localhost:4000', 
        'http://localhost:3006' ], // Adjust for production
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    console.log('WebSocket origin:', socket.handshake.headers.origin);
    next();
  });

  io.on('connection', (socket) => {
    console.log('A client connected');

    // Listen for room join
    socket.on('join_room', (roomId) => {
      socket.join(roomId);
      console.log(`Client joined room: ${roomId}`);
    });

    socket.on('disconnect', () => {
      console.log('A client disconnected');
    });
  });
};

const broadcastMessage = (roomId, message) => {
  if (io) {
    io.to(roomId).emit('message', message); // Broadcast to all clients in the room
  } else {
    console.log('Socket.io not initialized');
  }
};

// ADD this for chat messages
const emitChatMessage = (roomId, message) => {
  if (io) {
    io.to(roomId).emit('chat_message', message); // send only to specific room
  } else {
    console.log('Socket.io not initialized');
  }
};

module.exports = {
  initializeWebSocket,
  broadcastMessage,
  emitChatMessage,
};
