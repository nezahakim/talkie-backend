// const express = require("express");
// const http = require("http");
// const WebSocket = require("ws");
// const cors = require("cors");
// const helmet = require("helmet");
// const compression = require("compression");
// const { errorHandler } = require("../middleware/errorHandler");
// const { setupWebRTC } = require("../services/webRTC");
// const setupChatWebSocket = require("../services/chatWebSocket");

// const createServer = (app) => {
//   app.use(
//     cors({
//       origin: [
//         "https://talkie-two.vercel.app",
//         "wss://talkie-back.vercel.app",
//         API,
//       ],
//       methods: ["GET", "POST", "PUT", "DELETE"],
//       allowedHeaders: ["Content-Type", "Authorization", "x-auth-token"],
//     }),
//   );
//   app.use(helmet());
//   app.use(compression());
//   app.use(express.json());

//   const server = http.createServer(app);
//   setupChatWebSocket(server);

//   const wss = new WebSocket.Server({ server });

//   wss.on("connection", (ws) => {
//     setupWebRTC(ws);
//   });

//   app.use(errorHandler);

//   return server;
// };

// module.exports = { createServer };

const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const { errorHandler } = require("../middleware/errorHandler");
const { setupWebRTC } = require("../services/webRTC");
const setupChatSocketIO = require("../services/chatSocketIO");

const createServer = (app) => {
  app.use(
    cors({
      origin: [
        "https://talkie-two.vercel.app",
        "https://talkie-back.vercel.app",
      ],
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization", "x-auth-token"],
    }),
  );
  app.use(helmet());
  app.use(compression());
  app.use(express.json());

  const server = http.createServer(app);

  const io = socketIO(server);

  // Setup Socket.IO
  setupChatSocketIO(io);
  setupWebRTC(io);

  app.use(errorHandler);

  return server;
};

module.exports = { createServer };
