CREATE TABLE IF NOT EXISTS hasil_abw_history (
    category VARCHAR(50) PRIMARY KEY,
    data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


