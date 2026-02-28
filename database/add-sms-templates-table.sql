-- Create SMS templates table for managing autoresponse messages
-- Supports up to 5 active templates per transaction type that randomize

CREATE TABLE IF NOT EXISTS sms_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_type ENUM('bid_fee', 'bid', 'payment_failed', 'payment_cancelled', 'other') NOT NULL,
    template_text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_transaction_type_active (transaction_type, is_active),
    INDEX idx_display_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert current hardcoded templates as initial data
-- Bid Fee templates (5 templates)
INSERT INTO sms_templates (transaction_type, template_text, is_active, display_order) VALUES
('bid_fee', 'Bid fee Ksh {amount} received! Ref: {reference}\nYour bid is LIVE! Others are bidding too...\nStay sharp! Dial *855*22#', TRUE, 1),
('bid_fee', 'Bid fee confirmed! Ksh {amount} | Ref: {reference}\nYou''re in the game! Competition is heating up.\nDial *855*22# to stay ahead!', TRUE, 2),
('bid_fee', 'Bid active! Ksh {amount} | Ref: {reference}\nThe action is intense! Don''t miss out.\nDial *855*22# now!', TRUE, 3),
('bid_fee', 'Bid fee received! Ksh {amount} | Ref: {reference}\nYou''re competing! Others are watching.\nDial *855*22# to keep bidding!', TRUE, 4),
('bid_fee', 'Bid confirmed! Ksh {amount} | Ref: {reference}\nYou''re in the race! Every bid counts.\nDial *855*22# to continue!', TRUE, 5);

-- Bid templates (3 templates)
INSERT INTO sms_templates (transaction_type, template_text, is_active, display_order) VALUES
('bid', 'Bid {reference} of Ksh {amount} placed!\nThe competition is fierce! Keep bidding.\nDial *855*22#', TRUE, 1),
('bid', 'Your bid {reference} (Ksh {amount}) is active!\nOthers are bidding too. Stay competitive!\nDial *855*22#', TRUE, 2),
('bid', 'Bid {reference} confirmed! Ksh {amount}\nYou''re in the game! Don''t stop now.\nDial *855*22# to bid again!', TRUE, 3);

-- Payment failed templates (2 templates)
INSERT INTO sms_templates (transaction_type, template_text, is_active, display_order) VALUES
('payment_failed', 'Payment of Ksh {amount} failed.\nDon''t miss out! Dial *855*22# to retry now.', TRUE, 1),
('payment_failed', 'Payment failed! Ksh {amount}\nOthers are bidding! Retry quickly.\nDial *855*22# to get back in!', TRUE, 2);

-- Payment cancelled template (1 template)
INSERT INTO sms_templates (transaction_type, template_text, is_active, display_order) VALUES
('payment_cancelled', 'Payment cancelled. No charges made.\nGet back in the game! Dial *855*22# to try again.', TRUE, 1);

-- Other payments template (1 template)
INSERT INTO sms_templates (transaction_type, template_text, is_active, display_order) VALUES
('other', 'Payment of Ksh {amount} received! Ref: {reference}\nThank you for using LiveAuction!\nDial *855*22#', TRUE, 1);
