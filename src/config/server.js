const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const { errorHandler } = require("../middleware/errorHandler");
const { setupWebRTC } = require("../services/webRTC");
const setupChatSocketIO = require("../services/setupChatSocketIO");

const API =
  "https://super-bassoon-4j7vjrwggw59cjg7x-5173.app.github.dev";

const createServer = (app) => {
  app.use(
    cors({
      origin: [
        "https://talkie-two.vercel.app",
        "https://talkie-back.vercel.app",
        API,
      ],
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization", "x-auth-token"],
    }),
  );
  app.use(helmet());
  app.use(compression());
  app.use(express.json());

  const server = http.createServer(app);

  // const io = socketIO(server, { transports: ["websocket"] });
  const io = socketIO(server, {
    cors: {
      origin: [
        "https://talkie-two.vercel.app",
        "https://talkie-back.vercel.app",
        API,
      ],
      methods: ["GET", "POST", "PUT", "DELETE"],
    },
  });

  // Setup Socket.IO
  setupChatSocketIO(io);
  setupWebRTC(io);

  app.use(errorHandler);

  return server;
};

module.exports = { createServer };
