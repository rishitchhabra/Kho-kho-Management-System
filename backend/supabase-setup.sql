-- Supabase SQL Setup for Kho Kho Premier League
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ==================== DROP EXISTING TABLES (if needed) ====================
-- Uncomment the next two lines if you want to start fresh
-- DROP TABLE IF EXISTS public.matches;
-- DROP TABLE IF EXISTS public.pools;
-- DROP TABLE IF EXISTS public.admin_users;

-- ==================== ADMIN USERS TABLE ====================
CREATE TABLE IF NOT EXISTS public.admin_users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'editor' CHECK (role IN ('admin', 'editor', 'viewer')),
    permissions JSONB DEFAULT '{
        "teams": {"view": true, "add": true, "edit": true, "delete": false},
        "pools": {"view": true, "add": true, "edit": true, "delete": false, "fixMatch": true},
        "matches": {"view": true, "reorder": true, "complete": true, "edit": true, "delete": false},
        "users": {"view": false, "add": false, "edit": false, "delete": false, "toggleStatus": false}
    }'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists and create new one
DROP POLICY IF EXISTS "Allow all operations on admin_users" ON public.admin_users;
CREATE POLICY "Allow all operations on admin_users" ON public.admin_users
    FOR ALL USING (true) WITH CHECK (true);

-- Insert default admin user (password: khokho2024) with full permissions
INSERT INTO public.admin_users (username, password, display_name, role, permissions)
VALUES ('admin', 'khokho2024', 'Administrator', 'admin', '{
    "teams": {"view": true, "add": true, "edit": true, "delete": true},
    "pools": {"view": true, "add": true, "edit": true, "delete": true, "fixMatch": true},
    "matches": {"view": true, "reorder": true, "complete": true, "edit": true, "delete": true},
    "users": {"view": true, "add": true, "edit": true, "delete": true, "toggleStatus": true}
}'::jsonb)
ON CONFLICT (username) DO UPDATE SET 
    permissions = EXCLUDED.permissions,
    updated_at = NOW();

-- ==================== TEAMS TABLE UPDATE ====================
-- Add players column to store detailed player information
-- Run this to add the players column if teams table already exists
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS players JSONB DEFAULT '[]'::jsonb;

-- ==================== POOLS TABLE ====================
-- Using TEXT[] for team_ids to support any ID format (BIGINT or UUID)
CREATE TABLE IF NOT EXISTS public.pools (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    team_type VARCHAR(10) NOT NULL CHECK (team_type IN ('male', 'female')),
    team_ids TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists and create new one
DROP POLICY IF EXISTS "Allow all operations on pools" ON public.pools;
CREATE POLICY "Allow all operations on pools" ON public.pools
    FOR ALL USING (true) WITH CHECK (true);

-- ==================== MATCHES TABLE ====================
CREATE TABLE IF NOT EXISTS public.matches (
    id BIGSERIAL PRIMARY KEY,
    pool_id BIGINT REFERENCES public.pools(id) ON DELETE CASCADE,
    team1_id BIGINT NOT NULL,
    team2_id BIGINT NOT NULL,
    team_type VARCHAR(10) NOT NULL CHECK (team_type IN ('male', 'female')),
    status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed')),
    match_order INTEGER DEFAULT 0,
    match_number INTEGER,
    winner_id BIGINT,
    score VARCHAR(50),
    scheduled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add match_number column if table already exists
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS match_number INTEGER;

-- Enable RLS (Row Level Security)
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists and create new one
DROP POLICY IF EXISTS "Allow all operations on matches" ON public.matches;
CREATE POLICY "Allow all operations on matches" ON public.matches
    FOR ALL USING (true) WITH CHECK (true);

-- ==================== GRANT PERMISSIONS ====================
GRANT ALL ON public.pools TO anon;
GRANT ALL ON public.pools TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.pools_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.pools_id_seq TO authenticated;

GRANT ALL ON public.matches TO anon;
GRANT ALL ON public.matches TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.matches_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.matches_id_seq TO authenticated;

GRANT ALL ON public.admin_users TO anon;
GRANT ALL ON public.admin_users TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.admin_users_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.admin_users_id_seq TO authenticated;

-- ==================== VERIFY SETUP ====================
SELECT 'Setup complete! Tables created:' as message;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('pools', 'matches', 'admin_users');
