-- SQL to create login_logs and activity_logs tables in Supabase
-- Run this in your Supabase SQL Editor

-- Login Logs Table
CREATE TABLE IF NOT EXISTS login_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
    username VARCHAR(100),
    action VARCHAR(20) NOT NULL DEFAULT 'login', -- 'login' or 'logout'
    success BOOLEAN NOT NULL DEFAULT true,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
    username VARCHAR(100),
    module VARCHAR(50) NOT NULL, -- 'teams', 'pools', 'matches', 'users', 'session'
    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'view', 'extend', etc.
    entity_id VARCHAR(50), -- ID of the affected entity
    description TEXT, -- Human-readable description
    details JSONB, -- Additional structured data
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_login_logs_timestamp ON login_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_login_logs_username ON login_logs(username);
CREATE INDEX IF NOT EXISTS idx_login_logs_action ON login_logs(action);

CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_username ON activity_logs(username);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON activity_logs(module);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);

-- Enable Row Level Security (RLS) for security
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow insert for all" ON login_logs;
DROP POLICY IF EXISTS "Allow insert for all" ON activity_logs;
DROP POLICY IF EXISTS "Allow select for admins" ON login_logs;
DROP POLICY IF EXISTS "Allow select for admins" ON activity_logs;

-- Policy: Allow authenticated users to insert logs
CREATE POLICY "Allow insert for all" ON login_logs
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Allow insert for all" ON activity_logs
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- Policy: Allow authenticated users to view logs
CREATE POLICY "Allow select for admins" ON login_logs
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "Allow select for admins" ON activity_logs
    FOR SELECT TO anon, authenticated
    USING (true);

-- Grant permissions
GRANT SELECT, INSERT ON login_logs TO anon, authenticated;
GRANT SELECT, INSERT ON activity_logs TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE login_logs_id_seq TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE activity_logs_id_seq TO anon, authenticated;

-- ============================================================
-- UPDATE EXISTING USERS: Add new permissions (viewLogs, viewActivity)
-- ============================================================
-- Run this to update existing admin users with the new log permissions:

-- Update admin role users to have full log permissions
UPDATE admin_users 
SET permissions = jsonb_set(
    jsonb_set(permissions, '{users,viewLogs}', 'true'),
    '{users,viewActivity}', 'true'
)
WHERE role = 'admin';

-- Alternative: If you need to reset all admin permissions to full defaults
-- UPDATE admin_users 
-- SET permissions = '{
--     "teams": {"view": true, "add": true, "edit": true, "delete": true},
--     "pools": {"view": true, "add": true, "edit": true, "delete": true, "fixMatch": true},
--     "matches": {"view": true, "reorder": true, "complete": true, "edit": true, "delete": true},
--     "users": {"view": true, "add": true, "edit": true, "delete": true, "toggleStatus": true, "viewLogs": true, "viewActivity": true}
-- }'::jsonb
-- WHERE role = 'admin';

-- ============================================================
-- FIX EXISTING MATCHES: Set match_number from match_order if null
-- ============================================================
-- Run this to fix existing matches that don't have match_number set:

UPDATE matches 
SET match_number = match_order 
WHERE match_number IS NULL AND match_order IS NOT NULL;

-- Or to renumber all matches sequentially by team_type:
-- WITH numbered AS (
--     SELECT id, ROW_NUMBER() OVER (PARTITION BY team_type ORDER BY created_at, id) as new_num
--     FROM matches
-- )
-- UPDATE matches m
-- SET match_number = n.new_num
-- FROM numbered n
-- WHERE m.id = n.id;
