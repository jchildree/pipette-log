-- Repeater pipette tips: selecting a tip drives that entry's low/mid/high target
-- volumes, same pre-fill pattern equipment.low_ul/mid_ul/high_ul already gives
-- single/multi-channel pipettes. Empty until seeded with real tip data (pending).
CREATE TABLE tips (
    id          INT           IDENTITY(1,1) PRIMARY KEY,
    tip_id      NVARCHAR(50)  NOT NULL UNIQUE, -- e.g. "0.1mL", "1.25mL"
    low_ul      DECIMAL(10,3) NULL,
    mid_ul      DECIMAL(10,3) NULL,
    high_ul     DECIMAL(10,3) NULL,
    low_usage_ul DECIMAL(10,3) NULL, -- ADR-013: reference-only, not enforced
    unit        NVARCHAR(4)   NULL, -- ADR-013: 'uL' | 'mL' -- display-only, low/mid/high_ul stay canonical uL
    created_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
