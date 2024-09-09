const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function createTables() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        profile_picture VARCHAR(255),
        language VARCHAR(10) NOT NULL,
        country VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP WITH TIME ZONE
      )
    `);

    await client.query(`CREATE TABLE IF NOT EXISTS accounts (
  account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  full_name VARCHAR(100),
  bio TEXT,
  hashtags TEXT[],
  website_url VARCHAR(255),
  social_media_links JSONB,
  preferences JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
)
`);

    // Live Sessions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS live_sessions (
        session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        host_user_id UUID REFERENCES users(user_id),
        session_title VARCHAR(100) NOT NULL,
        description TEXT,
        language VARCHAR(10) NOT NULL,
        is_private BOOLEAN NOT NULL,
        is_temporary BOOLEAN NOT NULL,
        auto_delete BOOLEAN NOT NULL,
        started_at TIMESTAMP WITH TIME ZONE NOT NULL,
        ended_at TIMESTAMP WITH TIME ZONE
      )
    `);

    // Participants Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS participants (
        participant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES live_sessions(session_id),
        user_id UUID REFERENCES users(user_id),
        joined_at TIMESTAMP WITH TIME ZONE NOT NULL,
        left_at TIMESTAMP WITH TIME ZONE,
        is_anonymous BOOLEAN NOT NULL
      )
    `);

    // Community Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS community (
        community_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_by UUID REFERENCES users(user_id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Community Memberships Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS community_memberships (
        membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        community_id UUID REFERENCES community(community_id),
        user_id UUID REFERENCES users(user_id),
        role VARCHAR(20) NOT NULL,
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Followers Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS followers (
        follower_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(user_id),
        follower_user_id UUID REFERENCES users(user_id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Recommendations Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS recommendations (
        recommendation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(user_id),
        session_id UUID REFERENCES live_sessions(session_id),
        community_id UUID REFERENCES community(community_id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`

    CREATE TABLE IF NOT EXISTS chats (
      chat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chat_type VARCHAR(20) NOT NULL CHECK (chat_type IN ('private', 'community')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chat_participants (
      chat_id UUID REFERENCES chats(chat_id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
      joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (chat_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chat_id UUID REFERENCES chats(chat_id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
      message TEXT NOT NULL,
      pinned BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_chat_messages_chat_id ON chat_messages(chat_id);
    CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

    `);

    await client.query("COMMIT");
    console.log("All tables created successfully");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

createTables().catch((e) => console.error(e.stack));

// const { Pool } = require("pg");
// new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: {
//     rejectUnauthorized: false,
//   },
// })
//   .query(
//     "DO $$ DECLARE r RECORD; BEGIN FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = current_schema()) LOOP EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE'; EXECUTE 'DROP TABLE ' || quote_ident(r.tablename) || ' CASCADE'; END LOOP; END $$;",
//   )
//   .then(() => console.log("All tables truncated and deleted"))
//   .catch((err) => console.error("Error:", err));
