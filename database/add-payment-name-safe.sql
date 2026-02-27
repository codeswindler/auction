-- Add payment_name column to store bid selection (product label) or customer name from M-Pesa callback
-- This script is safe to run multiple times

-- Check if column exists before adding (MySQL 5.7+ / MariaDB 10.2+)
SET @dbname = DATABASE();
SET @tablename = 'transactions';
SET @columnname = 'payment_name';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1', -- Column exists, do nothing
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(255) DEFAULT NULL')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
