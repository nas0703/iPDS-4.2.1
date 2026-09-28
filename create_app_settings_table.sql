-- CREATE APP SETTINGS TABLE FOR SUPABASE
-- Run this script in your Supabase SQL Editor to support global logo syncing

CREATE TABLE IF NOT EXISTS app_settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Disable Row Level Security so all roles/devices can sync logo settings
ALTER TABLE IF EXISTS "app_settings" DISABLE ROW LEVEL SECURITY;


