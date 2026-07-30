-- Admin role flag: admins gate equipment add and user management (Users tab).
-- Everyone else stays a plain self-signup tech account.
ALTER TABLE users ADD is_admin BIT NOT NULL DEFAULT 0;
