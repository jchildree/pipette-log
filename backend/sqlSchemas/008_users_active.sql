-- Admin-controlled account deactivation, separate from PIN-lockout (which is
-- self-clearing after LOCKOUT_MINUTES). A deactivated account can't sign in
-- at all until an admin reactivates it.
ALTER TABLE users ADD is_active BIT NOT NULL DEFAULT 1;
