-- One sign-off event = one row = three measurement points (Low/Mid/High), per ADR-009.
-- For tolerance_3pct, each point's pass/fail is computed server-side from that point's
-- volume/mass; for manufacturer_spec/after_external_cal, each point's pass/fail is manual.
CREATE TABLE entries (
    id                  INT           IDENTITY(1,1) PRIMARY KEY,
    pipette_id          INT           NOT NULL REFERENCES equipment(id), -- app layer enforces equipment_type = 'Pipette'
    balance_id          INT           NOT NULL REFERENCES equipment(id), -- app layer enforces equipment_type = 'Balance'
    verification_type   NVARCHAR(30)  NOT NULL
                         CHECK (verification_type IN ('tolerance_3pct', 'manufacturer_spec', 'after_external_cal')),
    volume_low_ul        DECIMAL(10,3) NOT NULL,
    mass_low_mg          DECIMAL(10,3) NOT NULL,
    pass_low             CHAR(1)       NULL CHECK (pass_low IN ('Y', 'N')),
    volume_mid_ul        DECIMAL(10,3) NOT NULL,
    mass_mid_mg          DECIMAL(10,3) NOT NULL,
    pass_mid             CHAR(1)       NULL CHECK (pass_mid IN ('Y', 'N')),
    volume_high_ul       DECIMAL(10,3) NOT NULL,
    mass_high_mg         DECIMAL(10,3) NOT NULL,
    pass_high            CHAR(1)       NULL CHECK (pass_high IN ('Y', 'N')),
    note                NVARCHAR(MAX) NULL,  -- required at app layer for manufacturer_spec / after_external_cal
    signed_by_user_id   INT           NULL REFERENCES users(id),
    signed_at           DATETIME2     NULL, -- app-enforced immutability boundary: row is insert-only once set
    corrects_entry_id   INT           NULL REFERENCES entries(id), -- self-reference: correction chain (ADR-005)
    created_at          DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at          DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
