CREATE TABLE balances (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    name        NVARCHAR(100) NOT NULL,
    location    NVARCHAR(100) NULL,
    created_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
