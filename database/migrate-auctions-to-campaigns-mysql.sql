-- Migrate existing auctions into a default campaign (MySQL/MariaDB)
SET @default_campaign_id := NULL;

SELECT id INTO @default_campaign_id
FROM campaigns
WHERE name = 'Default Auction Campaign'
LIMIT 1;

INSERT INTO campaigns (name, menu_title, root_prompt, is_active)
SELECT 'Default Auction Campaign', 'Auctions', 'Select one of below active auctions:', 1
WHERE @default_campaign_id IS NULL;

SELECT id INTO @default_campaign_id
FROM campaigns
WHERE name = 'Default Auction Campaign'
LIMIT 1;

SET @rownum := -1;

INSERT INTO campaign_nodes (campaign_id, parent_id, label, prompt, action_type, action_payload, sort_order, is_active)
SELECT
  @default_campaign_id,
  NULL,
  a.title,
  NULL,
  'bid',
  JSON_OBJECT('amount', a.amount),
  (@rownum := @rownum + 1),
  a.is_active
FROM auctions a
WHERE NOT EXISTS (
  SELECT 1
  FROM campaign_nodes cn
  WHERE cn.campaign_id = @default_campaign_id AND cn.label = a.title
);
