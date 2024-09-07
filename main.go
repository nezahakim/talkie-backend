package main

import (
  "context"
  "log"
  "net/http"
  "os"
  "os/signal"
  "syscall"
  "time"

  "github.com/joho/godotenv"
  "github.com/nezahakim/talkie-backend/pkg/config"
  "github.com/nezahakim/talkie-backend/pkg/database"
  "github.com/nezahakim/talkie-backend/pkg/logger"
  "github.com/nezahakim/talkie-backend/pkg/metrics"
  "github.com/nezahakim/talkie-backend/pkg/server"
)

func main() {
  // Load environment variables
  if err := godotenv.Load(); err != nil {
    log.Fatal("Error loading .env file")
  }

  // Initialize logger
  logger := logger.NewLogger()

  // Load configuration
  cfg, err := config.LoadConfig()
  if err != nil {
    logger.Fatal("Failed to load configuration", "error", err)
  }

  // Initialize database connection
  db, err := database.NewPostgresDB(cfg.Database)
  if err != nil {
    logger.Fatal("Failed to connect to database", "error", err)
  }
  defer db.Close()

  // Initialize metrics collector
  metricsCollector := metrics.NewPrometheusCollector()

  // Create and configure the server
  s := server.NewServer(cfg, db, logger, metricsCollector)

  // Start the server
  go func() {
    if err := s.Start(); err != nil && err != http.ErrServerClosed {
      logger.Fatal("Failed to start server", "error", err)
    }
  }()

  // Wait for interrupt signal to gracefully shutdown the server
  quit := make(chan os.Signal, 1)
  signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
  <-quit

  logger.Info("Shutting down server...")

  ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
  defer cancel()

  if err := s.Shutdown(ctx); err != nil {
    logger.Fatal("Server forced to shutdown", "error", err)
  }

  logger.Info("Server exiting")
}
