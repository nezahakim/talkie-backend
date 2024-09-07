package middleware

import (
  "net/http"
  "time"

  "github.com/gin-gonic/gin"
  "github.com/nezahakim/talkie-backend/pkg/logger"
  "github.com/nezahakim/talkie-backend/pkg/metrics"
  "golang.org/x/time/rate"
)

func CORSMiddleware() gin.HandlerFunc {
  return func(c *gin.Context) {
    c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
    c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
    c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
    c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

    if c.Request.Method == "OPTIONS" {
      c.AbortWithStatus(204)
      return
    }

    c.Next()
  }
}

func RateLimiter(rps int) gin.HandlerFunc {
  limiter := rate.NewLimiter(rate.Limit(rps), rps)
  return func(c *gin.Context) {
    if !limiter.Allow() {
      c.AbortWithStatus(http.StatusTooManyRequests)
      return
    }
    c.Next()
  }
}

func RequestLogger(logger *logger.Logger) gin.HandlerFunc {
  return func(c *gin.Context) {
    start := time.Now()
    path := c.Request.URL.Path
    query := c.Request.URL.RawQuery

    c.Next()

    end := time.Now()
    latency := end.Sub(start)
    clientIP := c.ClientIP()
    method := c.Request.Method
    statusCode := c.Writer.Status()

    logger.Infow("Request",
      "status", statusCode,
      "method", method,
      "path", path,
      "query", query,
      "ip", clientIP,
      "latency", latency,
    )
  }
}

func Metrics(collector *metrics.PrometheusCollector) gin.HandlerFunc {
  return func(c *gin.Context) {
    start := time.Now()

    c.Next()

    duration := time.Since(start).Seconds()
    collector.IncrementHTTPRequests(c.Request.Method, c.FullPath(), c.Writer.Status())
    collector.ObserveHTTPRequestDuration(c.Request.Method, c.FullPath(), duration)
  }
}

func AuthMiddleware(authService AuthService) gin.HandlerFunc {
  return func(c *gin.Context) {
    token := c.GetHeader("Authorization")
    if token == "" {
      c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing authorization token"})
      return
    }

    userID, err := authService.ValidateToken(token)
    if err != nil {
      c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization token"})
      return
    }

    c.Set("userID", userID)
    c.Next()
  }
}
