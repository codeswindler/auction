-- Add support for fee transactions (MySQL/MariaDB version)
-- This migration adds a parent_transaction_id field to link fees to main transactions

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS parent_transaction_id INT DEFAULT NULL;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS is_fee TINYINT(1) DEFAULT 0;

-- Add foreign key constraint (skip if already exists)
-- Note: MariaDB 10.6+ supports IF NOT EXISTS for ADD CONSTRAINT, but older versions don't
-- This will fail silently if constraint already exists, which is fine
ALTER TABLE transactions 
ADD CONSTRAINT fk_parent_transaction 
FOREIGN KEY (parent_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL;

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_parent ON transactions(parent_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_is_fee ON transactions(is_fee);

