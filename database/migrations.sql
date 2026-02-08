-- Jenga Capital USSD Database Schema
-- MariaDB/MySQL compatible

CREATE DATABASE IF NOT EXISTS ussd_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE ussd_db;

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
    type VARCHAR(20) NOT NULL, -- 'loan', 'withdrawal', 'deposit'
    amount DECIMAL(15, 2) NOT NULL,
    reference VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'completed'
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

-- Create database user (adjust password as needed)
-- CREATE USER IF NOT EXISTS 'ussd_user'@'localhost' IDENTIFIED BY 'your_secure_password';
-- GRANT ALL PRIVILEGES ON ussd_db.* TO 'ussd_user'@'localhost';
-- FLUSH PRIVILEGES;

