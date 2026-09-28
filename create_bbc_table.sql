-- CREATE BBC TABLE FOR SUPABASE
-- Run this script in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS hasil_bbc_history (
    category text PRIMARY KEY,
    data jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Disable Row Level Security as per existing project patterns
ALTER TABLE IF EXISTS "hasil_bbc_history" DISABLE ROW LEVEL SECURITY;


