require("dotenv").config();
const express = require("express");
const { connectDB } = require("./config/database");
const { createServer } = require("./config/server");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const roomRoutes = require("./routes/roomRoutes");
const { logger } = require("./utils/logger");

const app = express();

// Connect to database
connectDB();

// Setup server and middleware
const server = createServer(app);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/rooms", roomRoutes);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => logger.info(`Server running on port ${PORT}`));

module.exports = app;
