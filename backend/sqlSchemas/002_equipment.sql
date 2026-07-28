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
    low_usage_ul          DECIMAL(10,3) NULL,             -- ADR-013: reference-only accuracy-floor value, not enforced
    unit                  NVARCHAR(4)   NULL,             -- ADR-013: 'uL' | 'mL' -- display-only, low/mid/high_ul stay canonical uL
    status                NVARCHAR(20)  NULL,             -- ADR-013: Active / Inactive from source inventory
    rack_number           NVARCHAR(50)  NULL,
    serial_number         NVARCHAR(50)  NULL,
    sub_location          NVARCHAR(100) NULL,
    last_calibration_date DATE          NULL,
    mechanism             NVARCHAR(50)  NULL,
    calibration_conducted_by NVARCHAR(100) NULL,
    ranges_used           NVARCHAR(100) NULL,
    department            NVARCHAR(50)  NULL,
    manufacturer          NVARCHAR(100) NULL,
    old_id                NVARCHAR(50)  NULL,
    review_comment        NVARCHAR(500) NULL,
    adjustment_comment    NVARCHAR(500) NULL,
    comments_2            NVARCHAR(500) NULL,
    created_at            DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
