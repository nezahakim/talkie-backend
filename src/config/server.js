const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const { errorHandler } = require("../middleware/errorHandler");
const { setupWebRTC } = require("../services/webRTC");

const createServer = (app) => {
  app.use(cors());
  app.use(helmet());
  app.use(compression());
  app.use(express.json());

  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });

  wss.on("connection", (ws) => {
    setupWebRTC(ws);
  });

  app.use(errorHandler);

  return server;
};

module.exports = { createServer };
