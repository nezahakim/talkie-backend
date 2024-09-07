package users

import (
  "errors"
  "sync"

  "github.com/nezahakim/talkie-backend/pkg/database"
  "github.com/nezahakim/talkie-backend/pkg/logger"
)

type UserManager struct {
  db     *database.PostgresDB
  logger *logger.Logger
  mutex  sync.RWMutex
}

func NewUserManager(db *database.PostgresDB, logger *logger.Logger) *UserManager {
  return &UserManager{
    db:     db,
    logger: logger,
  }
}

func (um *UserManager) Register(username, email, password, language, country string) (*User, error) {
  user, err := NewUser(username, email, password, language, country)
  if err != nil {
    return nil, err
  }

  err = um.db.CreateUser(user)
  if err != nil {
    um.logger.Error("Failed to create user in database", "error", err)
    return nil, err
  }

  um.logger.Info("User registered", "userID", user.ID, "username", user.Username)
  return user, nil
}

func (um *UserManager) Login(email, password string) (*User, error) {
  user, err := um.db.GetUserByEmail(email)
  if err != nil {
    return nil, err
  }

  if user == nil {
    return nil, errors.New("user not found")
  }

  if !user.CheckPassword(password) {
    return nil, errors.New("invalid password")
  }

  err = um.db.UpdateLastLogin(user.ID)
  if err != nil {
    um.logger.Error("Failed to update last login", "error", err)
  }

  um.logger.Info("User logged in", "userID", user.ID, "username", user.Username)
  return user, nil
}

func (um *UserManager) GetUser(userID string) (*User, error) {
  user, err := um.db.GetUser(userID)
  if err != nil {
    um.logger.Error("Failed to get user from database", "error", err)
    return nil, err
  }

  if user == nil {
    return nil, errors.New("user not found")
  }

  return user, nil
}

func (um *UserManager) UpdateUser(user *User) error {
  err := um.db.UpdateUser(user)
  if err != nil {
    um.logger.Error("Failed to update user in database", "error", err)
    return err
  }

  um.logger.Info("User updated", "userID", user.ID, "username", user.Username)
  return nil
}

func (um *UserManager) FollowUser(followerID, followedID string) error {
  err := um.db.CreateFollower(followerID, followedID)
  if err != nil {
    um.logger.Error("Failed to create follower relationship", "error", err)
    return err
  }

  um.logger.Info("User followed", "followerID", followerID, "followedID", followedID)
  return nil
}

func (um *UserManager) UnfollowUser(followerID, followedID string) error {
  err := um.db.DeleteFollower(followerID, followedID)
  if err != nil {
    um.logger.Error("Failed to delete follower relationship", "error", err)
    return err
  }

  um.logger.Info("User unfollowed", "followerID", followerID, "followedID", followedID)
  return nil
}

func (um *UserManager) GetFollowers(userID string, limit, offset int) ([]*User, error) {
  followers, err := um.db.GetFollowers(userID, limit, offset)
  if err != nil {
    um.logger.Error("Failed to get followers", "error", err)
    return nil, err
  }

  return followers, nil
}

func (um *UserManager) GetFollowing(userID string, limit, offset int) ([]*User, error) {
  following, err := um.db.GetFollowing(userID, limit, offset)
  if err != nil {
    um.logger.Error("Failed to get following", "error", err)
    return nil, err
  }

  return following, nil
}
