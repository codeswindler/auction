-- Campaigns + Campaign Nodes (MySQL/MariaDB)
CREATE TABLE IF NOT EXISTS campaigns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  menu_title VARCHAR(255) NOT NULL,
  root_prompt TEXT NOT NULL,
  bid_fee_min DECIMAL(15, 2) NOT NULL DEFAULT 30.00,
  bid_fee_max DECIMAL(15, 2) NOT NULL DEFAULT 99.00,
  bid_fee_prompt TEXT NOT NULL DEFAULT 'Please complete the bid on MPesa, ref: {{ref}}.',
  is_active TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaign_nodes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT NOT NULL,
  parent_id INT NULL,
  label VARCHAR(255) NOT NULL,
  prompt TEXT NULL,
  action_type VARCHAR(50) NULL,
  action_payload TEXT NULL,
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_campaign_nodes_campaign (campaign_id),
  INDEX idx_campaign_nodes_parent (parent_id),
  CONSTRAINT fk_campaign_nodes_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_campaign_nodes_parent
    FOREIGN KEY (parent_id) REFERENCES campaign_nodes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_campaigns_active ON campaigns(is_active);

-- If you already have the campaigns table, add missing columns:
-- ALTER TABLE campaigns
--   ADD COLUMN bid_fee_min DECIMAL(15, 2) NOT NULL DEFAULT 30.00,
--   ADD COLUMN bid_fee_max DECIMAL(15, 2) NOT NULL DEFAULT 99.00,
--   ADD COLUMN bid_fee_prompt TEXT NOT NULL DEFAULT 'Please complete the bid on MPesa, ref: {{ref}}.';
