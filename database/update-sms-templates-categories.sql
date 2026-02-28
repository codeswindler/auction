-- Update SMS templates to use simplified 3 categories:
-- 1. welcome - First time user dials
-- 2. bid_success - Successful bid/bid fee payments
-- 3. payment_failed - Failed or cancelled payments

-- First, update existing templates to new categories
UPDATE sms_templates 
SET transaction_type = 'bid_success' 
WHERE transaction_type IN ('bid_fee', 'bid', 'other');

UPDATE sms_templates 
SET transaction_type = 'payment_failed' 
WHERE transaction_type IN ('payment_failed', 'payment_cancelled');

-- Change ENUM to new categories
ALTER TABLE sms_templates 
MODIFY COLUMN transaction_type ENUM('welcome', 'bid_success', 'payment_failed') NOT NULL;

-- Insert welcome templates (for first-time dialers)
INSERT INTO sms_templates (transaction_type, template_text, is_active, display_order) VALUES
('welcome', 'Welcome to LiveAuction!\nStart bidding now and win amazing prizes.\nDial *855*22# to begin!', TRUE, 1),
('welcome', 'Welcome! Ready to bid?\nJoin the action and place your bids.\nDial *855*22# now!', TRUE, 2),
('welcome', 'Welcome to LiveAuction!\nYour chance to win starts here.\nDial *855*22# to get started!', TRUE, 3);
