-- Multichannel pipette entries: 8 channels x low/mid/high, per stakeholder update --
-- "essentially 8 verifications in 1". entries.volume_low_ul/mass_low_mg/pass_low (etc,
-- ADR-009) still get written for multichannel entries too, mirrored from channel 1, so
-- existing single-triplet audit/list queries keep working without a join; this table is
-- the full per-channel record. Single-channel entries never get rows here.
CREATE TABLE entry_channel_points (
    id          INT           IDENTITY(1,1) PRIMARY KEY,
    entry_id    INT           NOT NULL REFERENCES entries(id),
    channel     TINYINT       NOT NULL CHECK (channel BETWEEN 1 AND 8),
    point_key   NVARCHAR(4)   NOT NULL CHECK (point_key IN ('low', 'mid', 'high')),
    volume_ul   DECIMAL(10,3) NOT NULL,
    mass_mg     DECIMAL(10,3) NOT NULL,
    pass_fail   CHAR(1)       NOT NULL CHECK (pass_fail IN ('Y', 'N')),
    CONSTRAINT UQ_entry_channel_points UNIQUE (entry_id, channel, point_key)
);
