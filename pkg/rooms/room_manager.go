package rooms

import (
  "errors"
  "sync"
  "time"

  "github.com/nezahakim/talkie-backend/pkg/database"
  "github.com/nezahakim/talkie-backend/pkg/logger"
  "github.com/nezahakim/talkie-backend/pkg/users"
)

type RoomManager struct {
  rooms   map[string]*Room
  db      *database.PostgresDB
  logger  *logger.Logger
  mutex   sync.RWMutex
}

func NewRoomManager(db *database.PostgresDB, logger *logger.Logger) *RoomManager {
  rm := &RoomManager{
    rooms:  make(map[string]*Room),
    db:     db,
    logger: logger,
  }
  go rm.cleanupExpiredRooms()
  return rm
}

func (rm *RoomManager) CreateRoom(title, description, hostID, language string, isPrivate, isTemporary, autoDelete bool) (*Room, error) {
  room := NewRoom(title, description, hostID, language, isPrivate, isTemporary, autoDelete)

  // Save room to database
  err := rm.db.CreateRoom(room)
  if err != nil {
    rm.logger.Error("Failed to create room in database", "error", err)
    return nil, err
  }

  rm.mutex.Lock()
  rm.rooms[room.ID] = room
  rm.mutex.Unlock()

  rm.logger.Info("Room created", "roomID", room.ID, "hostID", hostID)
  return room, nil
}

func (rm *RoomManager) GetRoom(roomID string) (*Room, error) {
  rm.mutex.RLock()
  room, ok := rm.rooms[roomID]
  rm.mutex.RUnlock()

  if !ok {
    // Try to fetch from database
    dbRoom, err := rm.db.GetRoom(roomID)
    if err != nil {
      return nil, err
    }
    if dbRoom != nil {
      rm.mutex.Lock()
      rm.rooms[roomID] = dbRoom
      rm.mutex.Unlock()
      return dbRoom, nil
    }
    return nil, errors.New("room not found")
  }

  return room, nil
}

func (rm *RoomManager) JoinRoom(roomID string, user *users.User) error {
  room, err := rm.GetRoom(roomID)
  if err != nil {
    return err
  }

  if room.IsPrivate {
    // Implement private room join logic (e.g., check for invitation)
  }

  room.AddParticipant(user)
  err = rm.db.AddParticipant(roomID, user.ID)
  if err != nil {
    rm.logger.Error("Failed to add participant to database", "error", err)
    room.RemoveParticipant(user.ID)
    return err
  }

  rm.logger.Info("User joined room", "userID", user.ID, "roomID", roomID)
  return nil
}

func (rm *RoomManager) LeaveRoom(roomID string, userID string) error {
  room, err := rm.GetRoom(roomID)
  if err != nil {
    return err
  }

  room.RemoveParticipant(userID)
  err = rm.db.RemoveParticipant(roomID, userID)
  if err != nil {
    rm.logger.Error("Failed to remove participant from database", "error", err)
    return err
  }

  rm.logger.Info("User left room", "userID", userID, "roomID", roomID)

  if len(room.Participants) == 0 && room.AutoDelete {
    rm.EndRoom(roomID)
  }

  return nil
}

func (rm *RoomManager) EndRoom(roomID string) error {
  rm.mutex.Lock()
  defer rm.mutex.Unlock()

  room, ok := rm.rooms[roomID]
  if !ok {
    return errors.New("room not found")
  }

  room.End()
  delete(rm.rooms, roomID)

  err := rm.db.EndRoom(roomID)
  if err != nil {
    rm.logger.Error("Failed to end room in database", "error", err)
    return err
  }

  rm.logger.Info("Room ended", "roomID", roomID)
  return nil
}

func (rm *RoomManager) ListRooms(limit, offset int) ([]*Room, error) {
  rooms, err := rm.db.ListRooms(limit, offset)
  if err != nil {
    rm.logger.Error("Failed to list rooms from database", "error", err)
    return nil, err
  }

  return rooms, nil
}

func (rm *RoomManager) cleanupExpiredRooms() {
  ticker := time.NewTicker(15 * time.Minute)
  defer ticker.Stop()

  for range ticker.C {
    rm.mutex.Lock()
    for id, room := range rm.rooms {
      if room.IsTemporary && time.Since(room.StartedAt) > 24*time.Hour {
        rm.EndRoom(id)
      }
    }
    rm.mutex.Unlock()
  }
}
