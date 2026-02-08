-- Add payment tracking fields to transactions table
-- Run this migration to add M-Pesa payment tracking

-- Add payment method field (mpesa, bank, cash, etc.)
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT NULL;

-- Add M-Pesa receipt number
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS mpesa_receipt VARCHAR(50) DEFAULT NULL;

-- Add M-Pesa transaction ID
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS mpesa_transaction_id VARCHAR(50) DEFAULT NULL;

-- Add payment phone number (for M-Pesa)
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS payment_phone VARCHAR(20) DEFAULT NULL;

-- Add payment date (when payment was actually received)
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP DEFAULT NULL;

-- Add payment status (pending, paid, failed, cancelled)
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON transactions(payment_method);
CREATE INDEX IF NOT EXISTS idx_transactions_mpesa_receipt ON transactions(mpesa_receipt);

-- Update existing transactions to have payment_status = status
UPDATE transactions SET payment_status = status WHERE payment_status IS NULL;

