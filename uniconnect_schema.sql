-- =====================================================================
--  UniConnecT — Full PostgreSQL Database Schema
--  Team Mavericks · UIU · 2026–2027
--  Generated with Claude — includes inferred tables beyond original spec
-- =====================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";  -- for shuttle GPS coordinates

-- =====================================================================
-- DOMAIN 1: CORE / AUTH
-- =====================================================================

CREATE TABLE universities (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  domain        VARCHAR(100) UNIQUE NOT NULL,       -- e.g. "uiu.ac.bd"
  logo_url      TEXT,
  country       VARCHAR(100) DEFAULT 'Bangladesh',
  plan          VARCHAR(50) DEFAULT 'starter',      -- starter | pro | enterprise
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE university_settings (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id       UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  primary_color       VARCHAR(7) DEFAULT '#1a56db',
  secondary_color     VARCHAR(7) DEFAULT '#0e9f6e',
  allow_alumni_jobs   BOOLEAN DEFAULT TRUE,
  allow_public_feed   BOOLEAN DEFAULT FALSE,
  features_enabled    JSONB DEFAULT '{}',           -- toggleable feature flags
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(university_id)
);

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  role            VARCHAR(20) NOT NULL CHECK (role IN ('student','alumni','staff','admin')),
  is_verified     BOOLEAN DEFAULT FALSE,
  otp_code        VARCHAR(6),
  otp_expires_at  TIMESTAMPTZ,
  is_active       BOOLEAN DEFAULT TRUE,
  last_active_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name       VARCHAR(255) NOT NULL,
  avatar_url      TEXT,
  cover_url       TEXT,
  bio             TEXT,
  department      VARCHAR(100),
  batch_year      VARCHAR(10),                      -- e.g. "2022", "Spring 2023"
  headline        VARCHAR(255),
  linkedin_url    TEXT,
  phone           VARCHAR(30),
  skills          TEXT[],                           -- array of skill tags
  is_open_to_work BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE invitations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   UUID NOT NULL REFERENCES universities(id),
  invited_by      UUID REFERENCES users(id),        -- NULL = system invite
  email           VARCHAR(255) NOT NULL,
  role            VARCHAR(20) NOT NULL,
  token           VARCHAR(64) UNIQUE NOT NULL,
  is_used         BOOLEAN DEFAULT FALSE,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token   VARCHAR(256) UNIQUE NOT NULL,
  device_info     JSONB,
  ip_address      INET,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- DOMAIN 2: SOCIAL FEED
-- =====================================================================

CREATE TABLE posts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   UUID NOT NULL REFERENCES universities(id),
  author_id       UUID NOT NULL REFERENCES users(id),
  type            VARCHAR(30) DEFAULT 'post'
                  CHECK (type IN ('post','announcement','lost_found','news','event_promo')),
  content         TEXT NOT NULL,
  media_urls      TEXT[],
  group_id        UUID,                             -- optional: if posted inside a group
  is_pinned       BOOLEAN DEFAULT FALSE,
  view_count      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE comments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES users(id),
  parent_id       UUID REFERENCES comments(id),    -- for nested replies
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id),
  target_id       UUID NOT NULL,                   -- polymorphic: post_id or comment_id
  target_type     VARCHAR(20) NOT NULL CHECK (target_type IN ('post','comment')),
  reaction_type   VARCHAR(20) DEFAULT 'like'
                  CHECK (reaction_type IN ('like','love','insightful','celebrate')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_id, target_type)
);

CREATE TABLE follows (
  follower_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE saved_posts (
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE tags (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   UUID NOT NULL REFERENCES universities(id),
  name            VARCHAR(100) NOT NULL,
  UNIQUE(university_id, name)
);

CREATE TABLE post_tags (
  post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id          UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- Polls live inside posts
CREATE TABLE polls (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  question        VARCHAR(500) NOT NULL,
  expires_at      TIMESTAMPTZ,
  UNIQUE(post_id)
);

CREATE TABLE poll_options (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id         UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_text     VARCHAR(255) NOT NULL,
  display_order   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE poll_votes (
  poll_option_id  UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  voted_at        TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (poll_option_id, user_id)
);

-- =====================================================================
-- DOMAIN 3: JOB BOARD
-- =====================================================================

CREATE TABLE jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   UUID NOT NULL REFERENCES universities(id),
  posted_by       UUID NOT NULL REFERENCES users(id),
  title           VARCHAR(255) NOT NULL,
  company         VARCHAR(255) NOT NULL,
  location        VARCHAR(255),
  type            VARCHAR(30) DEFAULT 'full_time'
                  CHECK (type IN ('full_time','part_time','internship','remote','contract')),
  description     TEXT NOT NULL,
  requirements    TEXT[],
  salary_range    VARCHAR(100),
  application_url TEXT,                            -- external link (optional)
  deadline        TIMESTAMPTZ,
  is_active       BOOLEAN DEFAULT TRUE,
  view_count      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE job_applications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  applicant_id    UUID NOT NULL REFERENCES users(id),
  resume_url      TEXT,
  cover_letter    TEXT,
  status          VARCHAR(30) DEFAULT 'pending'
                  CHECK (status IN ('pending','reviewed','shortlisted','interviewed','offered','rejected')),
  notes           TEXT,                            -- internal recruiter notes
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, applicant_id)
);

CREATE TABLE saved_jobs (
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, job_id)
);

-- =====================================================================
-- DOMAIN 4: EVENTS
-- =====================================================================

CREATE TABLE events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   UUID NOT NULL REFERENCES universities(id),
  organizer_id    UUID NOT NULL REFERENCES users(id),
  group_id        UUID,                            -- optional: organized by a group
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  location        VARCHAR(255),
  is_online       BOOLEAN DEFAULT FALSE,
  online_link     TEXT,
  cover_url       TEXT,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ,
  capacity        INTEGER,
  type            VARCHAR(50) DEFAULT 'general'
                  CHECK (type IN ('general','career_fair','seminar','alumni_meetup','workshop','club')),
  is_published    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE event_rsvps (
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          VARCHAR(20) DEFAULT 'going'
                  CHECK (status IN ('going','maybe','not_going')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

-- =====================================================================
-- DOMAIN 5: GROUPS / CLUBS
-- =====================================================================

CREATE TABLE groups (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   UUID NOT NULL REFERENCES universities(id),
  created_by      UUID NOT NULL REFERENCES users(id),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  type            VARCHAR(30) DEFAULT 'other'
                  CHECK (type IN ('department','club','batch','research','interest','other')),
  avatar_url      TEXT,
  cover_url       TEXT,
  is_private      BOOLEAN DEFAULT FALSE,
  member_count    INTEGER DEFAULT 0,               -- denormalized counter
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE group_members (
  group_id        UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            VARCHAR(20) DEFAULT 'member'
                  CHECK (role IN ('owner','admin','moderator','member')),
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- =====================================================================
-- DOMAIN 6: REAL-TIME MESSAGING
-- =====================================================================

CREATE TABLE conversations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   UUID NOT NULL REFERENCES universities(id),
  name            VARCHAR(255),                    -- NULL for DMs
  is_group        BOOLEAN DEFAULT FALSE,
  avatar_url      TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE conversation_participants (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at    TIMESTAMPTZ,
  is_muted        BOOLEAN DEFAULT FALSE,
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id),
  content         TEXT,
  media_urls      TEXT[],
  reply_to_id     UUID REFERENCES messages(id),   -- quoted message
  type            VARCHAR(20) DEFAULT 'text'
                  CHECK (type IN ('text','image','file','system')),
  is_deleted      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- DOMAIN 7: NOTIFICATIONS & NEWS
-- =====================================================================

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            VARCHAR(50) NOT NULL,            -- like, comment, job, event, message, mention, follow, badge
  actor_id        UUID REFERENCES users(id),       -- who triggered it
  reference_id    UUID,                            -- polymorphic
  reference_type  VARCHAR(50),
  content         TEXT NOT NULL,
  is_read         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE news (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   UUID NOT NULL REFERENCES universities(id),
  author_id       UUID NOT NULL REFERENCES users(id),
  title           VARCHAR(500) NOT NULL,
  slug            VARCHAR(500),
  body            TEXT NOT NULL,
  cover_url       TEXT,
  category        VARCHAR(100),
  is_published    BOOLEAN DEFAULT FALSE,
  is_pinned       BOOLEAN DEFAULT FALSE,
  view_count      INTEGER DEFAULT 0,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- DOMAIN 8: CAMPUS TOOLS (Embedded Features)
-- =====================================================================

CREATE TABLE lost_and_found (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   UUID NOT NULL REFERENCES universities(id),
  posted_by       UUID NOT NULL REFERENCES users(id),
  type            VARCHAR(10) NOT NULL CHECK (type IN ('lost','found')),
  item_name       VARCHAR(255) NOT NULL,
  description     TEXT,
  images          TEXT[],
  location_detail VARCHAR(255),
  contact_info    VARCHAR(255),
  is_resolved     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE courses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   UUID NOT NULL REFERENCES universities(id),
  instructor_id   UUID REFERENCES users(id),       -- can be NULL (external courses)
  code            VARCHAR(20) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  credits         NUMERIC(4,2),
  description     TEXT,
  semester        VARCHAR(50),
  lms_url         TEXT,                            -- eLMS deep-link
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(university_id, code, semester)
);

CREATE TABLE user_courses (
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status          VARCHAR(20) DEFAULT 'enrolled'
                  CHECK (status IN ('enrolled','completed','dropped')),
  grade           VARCHAR(5),
  enrolled_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, course_id)
);

CREATE TABLE shuttle_routes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   UUID NOT NULL REFERENCES universities(id),
  name            VARCHAR(100) NOT NULL,
  color           VARCHAR(7),                      -- hex color for map display
  stops           JSONB,                           -- ordered list of stop names + coords
  schedule        JSONB,                           -- departure times by day
  is_active       BOOLEAN DEFAULT TRUE
);

CREATE TABLE shuttle_locations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id        UUID NOT NULL REFERENCES shuttle_routes(id),
  driver_id       UUID REFERENCES users(id),
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  speed_kmh       NUMERIC(5,2),
  heading_deg     NUMERIC(5,2),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- DOMAIN 9: ENGAGEMENT / GAMIFICATION / MODERATION
-- =====================================================================

CREATE TABLE mentorship_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id      UUID NOT NULL REFERENCES users(id),
  alumni_id       UUID NOT NULL REFERENCES users(id),
  message         TEXT,
  status          VARCHAR(20) DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','declined','completed')),
  session_notes   TEXT,                            -- post-session notes (alumni fills)
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  responded_at    TIMESTAMPTZ
);

CREATE TABLE badges (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(100) UNIQUE NOT NULL,
  description     TEXT,
  icon_url        TEXT,
  trigger_type    VARCHAR(50) NOT NULL,            -- first_post, first_job_apply, mentor, networker, etc.
  trigger_count   INTEGER DEFAULT 1,               -- e.g. award after 10 posts
  points          INTEGER DEFAULT 0
);

CREATE TABLE user_badges (
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id        UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id     UUID NOT NULL REFERENCES users(id),
  target_id       UUID NOT NULL,                   -- polymorphic target
  target_type     VARCHAR(50) NOT NULL,            -- post, comment, user, job, message
  reason          VARCHAR(50) NOT NULL
                  CHECK (reason IN ('spam','harassment','inappropriate','misinformation','other')),
  description     TEXT,
  status          VARCHAR(20) DEFAULT 'pending'
                  CHECK (status IN ('pending','reviewed','resolved','dismissed')),
  resolved_by     UUID REFERENCES users(id),       -- admin who resolved it
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

-- =====================================================================
-- INDEXES (performance)
-- =====================================================================

CREATE INDEX idx_users_university  ON users(university_id);
CREATE INDEX idx_users_role        ON users(role);
CREATE INDEX idx_posts_university  ON posts(university_id);
CREATE INDEX idx_posts_author      ON posts(author_id);
CREATE INDEX idx_posts_created     ON posts(created_at DESC);
CREATE INDEX idx_comments_post     ON comments(post_id);
CREATE INDEX idx_reactions_target  ON reactions(target_id, target_type);
CREATE INDEX idx_jobs_university   ON jobs(university_id);
CREATE INDEX idx_jobs_active       ON jobs(is_active, deadline);
CREATE INDEX idx_messages_conv     ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_follows_follower  ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);
CREATE INDEX idx_events_university ON events(university_id, starts_at);
CREATE INDEX idx_shuttle_updated   ON shuttle_locations(updated_at DESC);

-- =====================================================================
-- SEED DATA: Default badges
-- =====================================================================

INSERT INTO badges (name, description, trigger_type, trigger_count, points) VALUES
  ('First Post',       'Published your first post',               'post_created',       1, 10),
  ('Networker',        'Connected with 10 people',                'follow_count',       10, 25),
  ('Job Hunter',       'Applied to 3 jobs',                       'job_applied',        3, 20),
  ('Mentor',           'Accepted a mentorship request',           'mentorship_accept',  1, 50),
  ('Event Goer',       'RSVPd to 5 events',                       'event_rsvp',         5, 15),
  ('Top Contributor',  'Posted 50 times',                         'post_created',       50, 100),
  ('Alumni Bridge',    'Referred a student to a job opportunity', 'job_posted',         1, 30),
  ('Welcome Back',     'Logged in after 30 days',                 'return_login',       1, 5);
