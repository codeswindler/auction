-- Add payment_name column to store customer name from M-Pesa callback
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS payment_name VARCHAR(255) DEFAULT NULL;

