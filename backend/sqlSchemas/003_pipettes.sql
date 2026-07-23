CREATE TABLE pipettes (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    pipette_number  NVARCHAR(50)  NOT NULL UNIQUE,
    min_range       DECIMAL(10,2) NOT NULL,
    max_range       DECIMAL(10,2) NOT NULL,
    created_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
