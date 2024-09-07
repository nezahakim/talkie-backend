package users

import (
  "time"

  "github.com/google/uuid"
  "golang.org/x/crypto/bcrypt"
)

type User struct {
  ID              string
  Username        string
  Email           string
  PasswordHash    string
  ProfilePicture  string
  Language        string
  Country         string
  CreatedAt       time.Time
  LastLogin       *time.Time
  Bio             string
  Hashtags        []string
  ListeningHours  float64
  FollowersCount  int
  FollowingCount  int
}

func NewUser(username, email, password, language, country string) (*User, error) {
  passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
  if err != nil {
    return nil, err
  }

  return &User{
    ID:           uuid.New().String(),
    Username:     username,
    Email:        email,
    PasswordHash: string(passwordHash),
    Language:     language,
    Country:      country,
    CreatedAt:    time.Now(),
    Hashtags:     make([]string, 0),
  }, nil
}

func (u *User) CheckPassword(password string) bool {
  err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password))
  return err == nil
}

func (u *User) UpdatePassword(newPassword string) error {
  passwordHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
  if err != nil {
    return err
  }
  u.PasswordHash = string(passwordHash)
  return nil
}

func (u *User) AddHashtag(hashtag string) {
  u.Hashtags = append(u.Hashtags, hashtag)
}

func (u *User) RemoveHashtag(hashtag string) {
  for i, h := range u.Hashtags {
    if h == hashtag {
      u.Hashtags = append(u.Hashtags[:i], u.Hashtags[i+1:]...)
      break
    }
  }
}

func (u *User) UpdateListeningHours(duration time.Duration) {
  u.ListeningHours += duration.Hours()
}
