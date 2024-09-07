package rooms

import (
  "sync"
  "time"

  "github.com/google/uuid"
  "github.com/nezahakim/talkie-backend/pkg/users"
)

type Room struct {
  ID          string
  Title       string
  Description string
  HostID      string
  Language    string
  IsPrivate   bool
  IsTemporary bool
  AutoDelete  bool
  StartedAt   time.Time
  EndedAt     *time.Time
  Participants map[string]*users.User
  mutex       sync.RWMutex
}

func NewRoom(title, description, hostID, language string, isPrivate, isTemporary, autoDelete bool) *Room {
  return &Room{
    ID:           uuid.New().String(),
    Title:        title,
    Description:  description,
    HostID:       hostID,
    Language:     language,
    IsPrivate:    isPrivate,
    IsTemporary:  isTemporary,
    AutoDelete:   autoDelete,
    StartedAt:    time.Now(),
    Participants: make(map[string]*users.User),
  }
}

func (r *Room) AddParticipant(user *users.User) {
  r.mutex.Lock()
  defer r.mutex.Unlock()
  r.Participants[user.ID] = user
}

func (r *Room) RemoveParticipant(userID string) {
  r.mutex.Lock()
  defer r.mutex.Unlock()
  delete(r.Participants, userID)
}

func (r *Room) GetParticipants() []*users.User {
  r.mutex.RLock()
  defer r.mutex.RUnlock()
  participants := make([]*users.User, 0, len(r.Participants))
  for _, user := range r.Participants {
    participants = append(participants, user)
  }
  return participants
}

func (r *Room) IsParticipant(userID string) bool {
  r.mutex.RLock()
  defer r.mutex.RUnlock()
  _, ok := r.Participants[userID]
  return ok
}

func (r *Room) End() {
  now := time.Now()
  r.EndedAt = &now
}
