package server

import (
  "context"
  "fmt"
  "net/http"
  "time"

  "github.com/gin-gonic/gin"
  "github.com/nezahakim/talkie-backend/pkg/config"
  "github.com/nezahakim/talkie-backend/pkg/database"
  "github.com/nezahakim/talkie-backend/pkg/logger"
  "github.com/nezahakim/talkie-backend/pkg/metrics"
  "github.com/nezahakim/talkie-backend/pkg/middleware"
  "github.com/nezahakim/talkie-backend/pkg/rooms"
  "github.com/nezahakim/talkie-backend/pkg/users"
  "github.com/nezahakim/talkie-backend/pkg/websocket"
)

type Server struct {
  config           *config.Config
  db               *database.PostgresDB
  logger           *logger.Logger
  metricsCollector *metrics.PrometheusCollector
  router           *gin.Engine
  httpServer       *http.Server
  wsServer         *websocket.Server
  roomManager      *rooms.RoomManager
  userManager      *users.UserManager
}

func NewServer(cfg *config.Config, db *database.PostgresDB, logger *logger.Logger, metricsCollector *metrics.PrometheusCollector) *Server {
  s := &Server{
    config:           cfg,
    db:               db,
    logger:           logger,
    metricsCollector: metricsCollector,
    router:           gin.Default(),
    roomManager:      rooms.NewRoomManager(db, logger),
    userManager:      users.NewUserManager(db, logger),
  }

  s.setupRoutes()
  s.setupMiddleware()

  s.httpServer = &http.Server{
    Addr:    fmt.Sprintf(":%d", cfg.Server.Port),
    Handler: s.router,
  }

  s.wsServer = websocket.NewServer(s.roomManager, s.userManager, logger)

  return s
}

func (s *Server) setupMiddleware() {
  s.router.Use(middleware.CORSMiddleware())
  s.router.Use(middleware.RateLimiter(s.config.RateLimit))
  s.router.Use(middleware.RequestLogger(s.logger))
  s.router.Use(middleware.Metrics(s.metricsCollector))
}

func (s *Server) setupRoutes() {
  api := s.router.Group("/api")
  {
    users := api.Group("/users")
    {
      users.POST("/register", s.userManager.Register)
      users.POST("/login", s.userManager.Login)
      users.GET("/profile/:id", middleware.AuthMiddleware(), s.userManager.GetProfile)
      users.PUT("/profile", middleware.AuthMiddleware(), s.userManager.UpdateProfile)
      users.POST("/follow/:id", middleware.AuthMiddleware(), s.userManager.FollowUser)
      users.DELETE("/unfollow/:id", middleware.AuthMiddleware(), s.userManager.UnfollowUser)
    }

    rooms := api.Group("/rooms")
    {
      rooms.POST("/create", middleware.AuthMiddleware(), s.roomManager.CreateRoom)
      rooms.GET("/list", s.roomManager.ListRooms)
      rooms.GET("/:id", s.roomManager.GetRoom)
      rooms.POST("/:id/join", middleware.AuthMiddleware(), s.roomManager.JoinRoom)
      rooms.POST("/:id/leave", middleware.AuthMiddleware(), s.roomManager.LeaveRoom)
    }

    ws := api.Group("/ws")
    {
      ws.GET("/room/:id", s.wsServer.HandleRoomConnection)
    }
  }
}

func (s *Server) Start() error {
  s.logger.Info("Starting server", "port", s.config.Server.Port)
  return s.httpServer.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
  s.logger.Info("Shutting down server")
  return s.httpServer.Shutdown(ctx)
}

