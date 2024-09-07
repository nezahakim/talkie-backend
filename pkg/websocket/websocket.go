package websocket

import (
  "encoding/json"
  "net/http"
  "sync"
  "time"

  "github.com/gorilla/websocket"
  "github.com/nezahakim/talkie-backend/pkg/logger"
  "github.com/nezahakim/talkie-backend/pkg/rooms"
  "github.com/nezahakim/talkie-backend/pkg/users"
)

const (
  writeWait      = 10 * time.Second
  pongWait       = 60 * time.Second
  pingPeriod     = (pongWait * 9) / 10
  maxMessageSize = 512
)

var upgrader = websocket.Upgrader{
  ReadBufferSize:  1024,
  WriteBufferSize: 1024,
  CheckOrigin: func(r *http.Request) bool {
    return true // Allow all origins for now, implement proper origin check in production
  },
}

type Server struct {
  roomManager *rooms.RoomManager
  userManager *users.UserManager
  logger      *logger.Logger
  clients     map[*Client]bool
  broadcast   chan []byte
  register    chan *Client
  unregister  chan *Client
  mutex       sync.Mutex
}

type Client struct {
  server *Server
  conn   *websocket.Conn
  send   chan []byte
  roomID string
  userID string
}

func NewServer(roomManager *rooms.RoomManager, userManager *users.UserManager, logger *logger.Logger) *Server {
  return &Server{
    roomManager: roomManager,
    userManager: userManager,
    logger:      logger,
    clients:     make(map[*Client]bool),
    broadcast:   make(chan []byte),
    register:    make(chan *Client),
    unregister:  make(chan *Client),
  }
}

func (s *Server) HandleRoomConnection(w http.ResponseWriter, r *http.Request) {
  conn, err := upgrader.Upgrade(w, r, nil)
  if err != nil {
    s.logger.Error("Failed to upgrade connection to WebSocket", "error", err)
    return
  }

  roomID := r.URL.Query().Get("room_id")
  userID := r.URL.Query().Get("user_id")

  client := &Client{
    server: s,
    conn:   conn,
    send:   make(chan []byte, 256),
    roomID: roomID,
    userID: userID,
  }

  s.register <- client

  go client.writePump()
  go client.readPump()
}

func (c *Client) readPump() {
  defer func() {
    c.server.unregister <- c
    c.conn.Close()
  }()

  c.conn.SetReadLimit(maxMessageSize)
  c.conn.SetReadDeadline(time.Now().Add(pongWait))
  c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })

  for {
    _, message, err := c.conn.ReadMessage()
    if err != nil {
      if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
        c.server.logger.Error("WebSocket read error", "error", err)
      }
      break
    }
    c.server.broadcast <- message
  }
}

func (c *Client) writePump() {
  ticker := time.NewTicker(pingPeriod)
  defer func() {
    ticker.Stop()
    c.conn.Close()
  }()

  for {
    select {
    case message, ok := <-c.send:
      c.conn.SetWriteDeadline(time.Now().Add(writeWait))
      if !ok {
        c.conn.WriteMessage(websocket.CloseMessage, []byte{})
        return
      }

      w, err := c.conn.NextWriter(websocket.TextMessage)
      if err != nil {
        return
      }
      w.Write(message)

      n := len(c.send)
      for i := 0; i < n; i++ {
        w.Write([]byte{'\n'})
        w.Write(<-c.send)
      }

      if err := w.Close(); err != nil {
        return
      }
    case <-ticker.C:
      c.conn.SetWriteDeadline(time.Now().Add(writeWait))
      if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
        return
      }
    }
  }
}

func (s *Server) Run() {
  for {
    select {
    case client := <-s.register:
      s.mutex.Lock()
      s.clients[client] = true
      s.mutex.Unlock()
    case client := <-s.unregister:
      s.mutex.Lock()
      if _, ok := s.clients[client]; ok {
        delete(s.clients, client)
        close(client.send)
      }
      s.mutex.Unlock()
    case message := <-s.broadcast:
      s.mutex.Lock()
      for client := range s.clients {
        select {
        case client.send <- message:
        default:
          close(client.send)
          delete(s.clients, client)
        }
      }
      s.mutex.Unlock()
    }
  }
}

func (s *Server) BroadcastToRoom(roomID string, message []byte) {
  s.mutex.Lock()
  defer s.mutex.Unlock()

  for client := range s.clients {
    if client.roomID == roomID {
      select {
      case client.send <- message:
      default:
        close(client.send)
        delete(s.clients, client)
      }
    }
  }
}

func (s *Server) SendToUser(userID string, message []byte) {
  s.mutex.Lock()
  defer s.mutex.Unlock()

  for client := range s.clients {
    if client.userID == userID {
      select {
      case client.send <- message:
      default:
        close(client.send)
        delete(s.clients, client)
      }
      break
    }
  }
}