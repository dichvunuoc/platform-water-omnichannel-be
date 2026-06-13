-- Auth tables with varchar IDs (better-auth uses nanoid, not UUID)
-- Replaces UUID-based tables from 0000/0001

-- Drop old tables if they exist with UUID types
DROP TABLE IF EXISTS provider_links CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS verification CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id varchar(256) PRIMARY KEY,
  email varchar(512),
  phone varchar(512),
  email_hash varchar(64),
  phone_hash varchar(64),
  name varchar(255),
  phone_number varchar(512),
  phone_number_verified boolean DEFAULT false,
  email_verified boolean DEFAULT false,
  image varchar(1024),
  role user_role DEFAULT 'customer',
  status user_status DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_hash ON users(phone_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id varchar(256) PRIMARY KEY,
  user_id varchar(256) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token varchar(512) NOT NULL,
  expires_at timestamptz NOT NULL,
  ip_address varchar(255),
  user_agent varchar(1024),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Verification table (for OTP)
CREATE TABLE IF NOT EXISTS verification (
  id varchar(256) PRIMARY KEY,
  identifier varchar(255) NOT NULL,
  value varchar(255) NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification(identifier);

-- Provider links table
CREATE TABLE IF NOT EXISTS provider_links (
  id varchar(256) PRIMARY KEY,
  user_id varchar(256) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_type provider_type NOT NULL,
  provider_id varchar(255) NOT NULL,
  provider_email varchar(255),
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_links_type_id ON provider_links(provider_type, provider_id);
