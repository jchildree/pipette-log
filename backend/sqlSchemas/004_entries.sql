CREATE TABLE entries (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    pipette_id          INT           NOT NULL REFERENCES pipettes(id),
    balance_id          INT           NOT NULL REFERENCES balances(id),
    verification_type   NVARCHAR(30)  NOT NULL
                         CHECK (verification_type IN ('tolerance_3pct', 'manufacturer_spec', 'after_external_cal')),
    volume_ul           DECIMAL(10,3) NOT NULL,
    mass_mg             DECIMAL(10,3) NOT NULL,
    pass_fail           CHAR(1)       NULL CHECK (pass_fail IN ('Y', 'N')),
    note                NVARCHAR(MAX) NULL,  -- required at app layer for manufacturer_spec / after_external_cal
    signed_by_user_id   INT           NULL REFERENCES users(id),
    signed_at           DATETIME2     NULL, -- app-enforced immutability boundary: row is insert-only once set
    corrects_entry_id   INT           NULL REFERENCES entries(id), -- self-reference: correction chain (ADR-005)
    created_at          DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at          DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
