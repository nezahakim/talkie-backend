const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const { errorHandler } = require("../middleware/errorHandler");
const { setupWebRTC } = require("../services/webRTC");
const setupChatWebSocket = require("../services/chatWebSocket");

const API =
  "https://94458d4a-03fc-40fe-9c73-a107faef071c-00-126sm7vflti8p.spock.replit.dev:5173";
const createServer = (app) => {
  app.use(
    cors({
      origin: [
        "https://talkie-two.vercel.app",
        "wss://talkie-back.vercel.app",
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
  setupChatWebSocket(server);

  const wss = new WebSocket.Server({ server });

  wss.on("connection", (ws) => {
    setupWebRTC(ws);
  });

  app.use(errorHandler);

  return server;
};

module.exports = { createServer };
