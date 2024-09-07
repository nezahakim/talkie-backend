package database

import (
  "context"
  "database/sql"
  "time"

  "github.com/jmoiron/sqlx"
  _ "github.com/lib/pq"
  "github.com/nezahakim/talkie-backend/pkg/config"
  "github.com/nezahakim/talkie-backend/pkg/rooms"
  "github.com/nezahakim/talkie-backend/pkg/users"
)

type PostgresDB struct {
  db *sqlx.DB
}

func NewPostgresDB(cfg config.DatabaseConfig) (*PostgresDB, error) {
  db, err := sqlx.Connect("postgres", cfg.URL)
  if err != nil {
    return nil, err
  }

  db.SetMaxOpenConns(cfg.MaxOpenConns)
  db.SetMaxIdleConns(cfg.MaxIdleConns)
  db.SetConnMaxLifetime(time.Duration(cfg.ConnMaxLifetime) * time.Second)

  return &PostgresDB{db: db}, nil
}

func (pdb *PostgresDB) Close() error {
  return pdb.db.Close()
}

// User-related database operations

func (pdb *PostgresDB) CreateUser(user *users.User) error {
  query := `
    INSERT INTO users (user_id, username, email, password_hash, language, country, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `
  _, err := pdb.db.Exec(query, user.ID, user.Username, user.Email, user.PasswordHash, user.Language, user.Country, user.CreatedAt)
  return err
}

func (pdb *PostgresDB) GetUser(userID string) (*users.User, error) {
  var user users.User
  query := `SELECT * FROM users WHERE user_id = $1`
  err := pdb.db.Get(&user, query, userID)
  if err == sql.ErrNoRows {
    return nil, nil
  }
  return &user, err
}

func (pdb *PostgresDB) GetUserByEmail(email string) (*users.User, error) {
  var user users.User
  query := `SELECT * FROM users WHERE email = $1`
  err := pdb.db.Get(&user, query, email)
  if err == sql.ErrNoRows {
    return nil, nil
  }
  return &user, err
}

func (pdb *PostgresDB) UpdateUser(user *users.User) error {
  query := `
    UPDATE users
    SET username = $2, email = $3, profile_picture = $4, language = $5, country = $6, bio = $7
    WHERE user_id = $1
  `
  _, err := pdb.db.Exec(query, user.ID, user.Username, user.Email, user.ProfilePicture, user.Language, user.Country, user.Bio)
  return err
}

func (pdb *PostgresDB) UpdateLastLogin(userID string) error {
  query := `UPDATE users SET last_login = $2 WHERE user_id = $1`
  _, err := pdb.db.Exec(query, userID, time.Now())
  return err
}

func (pdb *PostgresDB) CreateFollower(followerID, followedID string) error {
  query := `INSERT INTO followers (user_id, follower_user_id) VALUES ($1, $2)`
    _, err := pdb.db.Exec(query, followedID, followerID)
    return err
  }

  func (pdb *PostgresDB) DeleteFollower(followerID, followedID string) error {
    query := `DELETE FROM followers WHERE user_id = $1 AND follower_user_id = $2`
    _, err := pdb.db.Exec(query, followedID, followerID)
    return err
  }

  func (pdb *PostgresDB) GetFollowers(userID string, limit, offset int) ([]*users.User, error) {
    query := `
      SELECT u.* FROM users u
      INNER JOIN followers f ON u.user_id = f.follower_user_id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
      LIMIT $2 OFFSET $3
    `
    var followers []*users.User
    err := pdb.db.Select(&followers, query, userID, limit, offset)
    return followers, err
  }

  func (pdb *PostgresDB) GetFollowing(userID string, limit, offset int) ([]*users.User, error) {
    query := `
      SELECT u.* FROM users u
      INNER JOIN followers f ON u.user_id = f.user_id
      WHERE f.follower_user_id = $1
      ORDER BY f.created_at DESC
      LIMIT $2 OFFSET $3
    `
    var following []*users.User
    err := pdb.db.Select(&following, query, userID, limit, offset)
    return following, err
  }

  // Room-related database operations

  func (pdb *PostgresDB) CreateRoom(room *rooms.Room) error {
    query := `
      INSERT INTO live_sessions (session_id, host_user_id, session_title, description, language, is_private, is_temporary, auto_delete, started_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `
    _, err := pdb.db.Exec(query, room.ID, room.HostID, room.Title, room.Description, room.Language, room.IsPrivate, room.IsTemporary, room.AutoDelete, room.StartedAt)
    return err
  }

  func (pdb *PostgresDB) GetRoom(roomID string) (*rooms.Room, error) {
    var room rooms.Room
    query := `SELECT * FROM live_sessions WHERE session_id = $1`
    err := pdb.db.Get(&room, query, roomID)
    if err == sql.ErrNoRows {
      return nil, nil
    }
    return &room, err
  }

  func (pdb *PostgresDB) ListRooms(limit, offset int) ([]*rooms.Room, error) {
    query := `
      SELECT * FROM live_sessions
      WHERE ended_at IS NULL
      ORDER BY started_at DESC
      LIMIT $1 OFFSET $2
    `
    var roomList []*rooms.Room
    err := pdb.db.Select(&roomList, query, limit, offset)
    return roomList, err
  }

  func (pdb *PostgresDB) EndRoom(roomID string) error {
    query := `UPDATE live_sessions SET ended_at = $2 WHERE session_id = $1`
    _, err := pdb.db.Exec(query, roomID, time.Now())
    return err
  }

  func (pdb *PostgresDB) AddParticipant(roomID, userID string) error {
    query := `
      INSERT INTO participants (session_id, user_id, joined_at, is_anonymous)
      VALUES ($1, $2, $3, $4)
    `
    _, err := pdb.db.Exec(query, roomID, userID, time.Now(), false)
    return err
  }

  func (pdb *PostgresDB) RemoveParticipant(roomID, userID string) error {
    query := `UPDATE participants SET left_at = $3 WHERE session_id = $1 AND user_id = $2`
    _, err := pdb.db.Exec(query, roomID, userID, time.Now())
    return err
  }

  func (pdb *PostgresDB) GetParticipants(roomID string) ([]*users.User, error) {
    query := `
      SELECT u.* FROM users u
      INNER JOIN participants p ON u.user_id = p.user_id
      WHERE p.session_id = $1 AND p.left_at IS NULL
    `
    var participants []*users.User
    err := pdb.db.Select(&participants, query, roomID)
    return participants, err
  }

  // Chat-related database operations

  func (pdb *PostgresDB) SaveChatMessage(roomID, userID, message string) error {
    query := `
      INSERT INTO chat_messages (session_id, user_id, message)
      VALUES ($1, $2, $3)
    `
    _, err := pdb.db.Exec(query, roomID, userID, message)
    return err
  }

  func (pdb *PostgresDB) GetChatMessages(roomID string, limit, offset int) ([]*ChatMessage, error) {
    query := `
      SELECT * FROM chat_messages
      WHERE session_id = $1
      ORDER BY timestamp DESC
      LIMIT $2 OFFSET $3
    `
    var messages []*ChatMessage
    err := pdb.db.Select(&messages, query, roomID, limit, offset)
    return messages, err
  }

  // Community-related database operations

  func (pdb *PostgresDB) CreateCommunity(community *Community) error {
    query := `
      INSERT INTO community (community_id, name, description, created_by)
      VALUES ($1, $2, $3, $4)
    `
    _, err := pdb.db.Exec(query, community.ID, community.Name, community.Description, community.CreatedBy)
    return err
  }

  func (pdb *PostgresDB) GetCommunity(communityID string) (*Community, error) {
    var community Community
    query := `SELECT * FROM community WHERE community_id = $1`
    err := pdb.db.Get(&community, query, communityID)
    if err == sql.ErrNoRows {
      return nil, nil
    }
    return &community, err
  }

  func (pdb *PostgresDB) ListCommunities(limit, offset int) ([]*Community, error) {
    query := `
      SELECT * FROM community
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `
    var communities []*Community
    err := pdb.db.Select(&communities, query, limit, offset)
    return communities, err
  }

  func (pdb *PostgresDB) JoinCommunity(communityID, userID string, role string) error {
    query := `
      INSERT INTO community_memberships (community_id, user_id, role)
      VALUES ($1, $2, $3)
    `
    _, err := pdb.db.Exec(query, communityID, userID, role)
    return err
  }

  func (pdb *PostgresDB) LeaveCommunity(communityID, userID string) error {
    query := `DELETE FROM community_memberships WHERE community_id = $1 AND user_id = $2`
    _, err := pdb.db.Exec(query, communityID, userID)
    return err
  }

  func (pdb *PostgresDB) GetCommunityMembers(communityID string, limit, offset int) ([]*users.User, error) {
    query := `
      SELECT u.* FROM users u
      INNER JOIN community_memberships cm ON u.user_id = cm.user_id
      WHERE cm.community_id = $1
      ORDER BY cm.joined_at DESC
      LIMIT $2 OFFSET $3
    `
    var members []*users.User
    err := pdb.db.Select(&members, query, communityID, limit, offset)
    return members, err
  }

  // Recommendation-related database operations

  func (pdb *PostgresDB) SaveRecommendation(recommendation *Recommendation) error {
    query := `
      INSERT INTO recommendations (user_id, session_id, community_id)
      VALUES ($1, $2, $3)
    `
    _, err := pdb.db.Exec(query, recommendation.UserID, recommendation.SessionID, recommendation.CommunityID)
    return err
  }

  func (pdb *PostgresDB) GetRecommendations(userID string, limit int) ([]*Recommendation, error) {
    query := `
      SELECT * FROM recommendations
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `
    var recommendations []*Recommendation
    err := pdb.db.Select(&recommendations, query, userID, limit)
    return recommendations, err
  }

