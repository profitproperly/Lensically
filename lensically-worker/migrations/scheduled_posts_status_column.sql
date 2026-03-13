ALTER TABLE scheduled_posts
ADD COLUMN status TEXT NOT NULL DEFAULT 'approved';
