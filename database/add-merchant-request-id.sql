-- Add MerchantRequestID/CheckoutRequestID field to transactions table
-- This helps match M-Pesa callbacks to transactions more accurately

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS merchant_request_id VARCHAR(100) DEFAULT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_merchant_request_id ON transactions(merchant_request_id);

