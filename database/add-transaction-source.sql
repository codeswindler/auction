-- Add transaction source field to track where transactions come from
-- Values: 'ussd' or 'web'

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS source VARCHAR(10) DEFAULT 'ussd';

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(source);

-- Update existing transactions to default to 'ussd' (since they were created via USSD)
UPDATE transactions SET source = 'ussd' WHERE source IS NULL OR source = '';

