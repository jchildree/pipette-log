-- Failed retry attempts leading up to a point's final (passing) reading, per ADR-010.
-- The passing reading itself still lives on entries.*_low/mid/high_* (ADR-009, unchanged) --
-- this table only holds the attempts that came before it. tolerance_3pct only: the other
-- verification types have no computed pass/fail to trigger a retry.
CREATE TABLE entry_point_attempts (
    id              INT           IDENTITY(1,1) PRIMARY KEY,
    entry_id        INT           NOT NULL REFERENCES entries(id),
    point_key       NVARCHAR(4)   NOT NULL CHECK (point_key IN ('low', 'mid', 'high')),
    channel         TINYINT       NULL CHECK (channel BETWEEN 1 AND 8), -- NULL for single-channel; multichannel channel number otherwise
    attempt_number  INT           NOT NULL CHECK (attempt_number > 0),
    volume_ul       DECIMAL(10,3) NOT NULL,
    mass_mg         DECIMAL(10,3) NOT NULL,
    pass_fail       CHAR(1)       NOT NULL CHECK (pass_fail IN ('Y', 'N')), -- always 'N' in practice; stored explicitly rather than implied
    created_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_entry_point_attempts UNIQUE (entry_id, point_key, channel, attempt_number)
);
