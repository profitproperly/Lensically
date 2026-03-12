ALTER TABLE users
ADD COLUMN clock_format TEXT NOT NULL DEFAULT '12h' CHECK (clock_format IN ('12h', '24h'));
