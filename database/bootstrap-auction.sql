-- Auction database schema (MariaDB)
-- Run this after creating the auction database

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    id_number VARCHAR(50) NULL,
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    loan_limit DECIMAL(15, 2) NOT NULL DEFAULT 25100.00,
    has_active_loan TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_phone (phone_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(20) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    reference VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_created (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- USSD Sessions table
CREATE TABLE IF NOT EXISTS ussd_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL UNIQUE,
    phone_number VARCHAR(20) NOT NULL,
    ussd_code VARCHAR(50) NOT NULL,
    input_history TEXT NOT NULL DEFAULT '',
    current_menu VARCHAR(50) NOT NULL DEFAULT 'main',
    last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_session (session_id),
    INDEX idx_phone (phone_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    INDEX idx_username (username),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Auctions table
CREATE TABLE IF NOT EXISTS auctions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default admin (username: admin, password: admin123)
INSERT INTO admins (username, password_hash, is_active)
VALUES ('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', TRUE)
ON DUPLICATE KEY UPDATE username=username;

-- Extra transaction fields for fees and M-Pesa tracking
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS parent_transaction_id INT DEFAULT NULL;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS is_fee TINYINT(1) DEFAULT 0;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT NULL;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS mpesa_receipt VARCHAR(50) DEFAULT NULL;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS mpesa_transaction_id VARCHAR(50) DEFAULT NULL;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS payment_phone VARCHAR(20) DEFAULT NULL;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP DEFAULT NULL;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';
ADD COLUMN IF NOT EXISTS payment_failure_reason VARCHAR(255) DEFAULT NULL;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS payment_name VARCHAR(255) DEFAULT NULL;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS merchant_request_id VARCHAR(100) DEFAULT NULL;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS source VARCHAR(10) DEFAULT 'ussd';

ALTER TABLE transactions 
ADD CONSTRAINT fk_parent_transaction 
FOREIGN KEY (parent_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_parent ON transactions(parent_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_is_fee ON transactions(is_fee);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_failure_reason ON transactions(payment_failure_reason);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON transactions(payment_method);
CREATE INDEX IF NOT EXISTS idx_transactions_mpesa_receipt ON transactions(mpesa_receipt);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant_request_id ON transactions(merchant_request_id);
CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(source);

UPDATE transactions SET payment_status = status WHERE payment_status IS NULL;
UPDATE transactions SET source = 'ussd' WHERE source IS NULL OR source = '';
