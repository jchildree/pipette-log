-- Unified table for both pipettes and balances (source: Simple table.xlsx real inventory).
-- The spec draft models these as one "Equipment" table with a type discriminator,
-- not two separate tables -- pipette_range/category/low/mid/high are pipette-only
-- and NULL for balance rows.
CREATE TABLE equipment (
    id                    INT IDENTITY(1,1) PRIMARY KEY,
    equipment_type        NVARCHAR(20)  NOT NULL CHECK (equipment_type IN ('Pipette', 'Balance')),
    equipment_id          NVARCHAR(50)  NOT NULL UNIQUE, -- business key, e.g. "PI-007", "BAL-001"
    category              NVARCHAR(50)  NULL,            -- pipette only: single channel / multi channel / repeater / positive displacement
    pipette_range         NVARCHAR(50)  NULL,             -- pipette only: free-text range as recorded (units/format are inconsistent in source data)
    calibration_due_date  DATE          NULL,
    low_ul                DECIMAL(10,3) NULL,             -- pipette only: 3-point verification targets
    mid_ul                DECIMAL(10,3) NULL,
    high_ul               DECIMAL(10,3) NULL,
    created_at            DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
