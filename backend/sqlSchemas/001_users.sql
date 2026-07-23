CREATE TABLE users (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    username        NVARCHAR(50)  NOT NULL UNIQUE,
    pin_hash        NVARCHAR(200) NULL,        -- NULL until first-login self-service PIN set
    failed_attempts INT           NOT NULL DEFAULT 0,
    locked_until    DATETIME2     NULL,        -- PIN-guess rate limiting
    created_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
