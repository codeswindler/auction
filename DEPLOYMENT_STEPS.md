# Full VPS Deployment Steps

## Prerequisites
- SSH access to VPS
- Root or sudo access
- Database credentials ready

## Step 1: Navigate to Project Directory
```bash
cd /var/www/auctionorwhat
```

## Step 2: Pull Latest Code
```bash
git pull
```

## Step 3: Run Database Migrations

### 3a. Create SMS Templates Table (if not already done)
```bash
mysql -u auction_user -p auction < database/add-sms-templates-table.sql
```

### 3b. Update SMS Templates Categories (3 categories: welcome, bid_success, payment_failed)
```bash
mysql -u auction_user -p auction < database/update-sms-templates-categories.sql
```

**Note:** If you get an error about existing templates, you can manually update:
```bash
mysql -u auction_user -p auction
```

Then run:
```sql
-- Update existing templates
UPDATE sms_templates SET transaction_type = 'bid_success' WHERE transaction_type IN ('bid_fee', 'bid', 'other');
UPDATE sms_templates SET transaction_type = 'payment_failed' WHERE transaction_type IN ('payment_failed', 'payment_cancelled');

-- Change ENUM
ALTER TABLE sms_templates MODIFY COLUMN transaction_type ENUM('welcome', 'bid_success', 'payment_failed') NOT NULL;

-- Insert welcome templates if they don't exist
INSERT INTO sms_templates (transaction_type, template_text, is_active, display_order) 
SELECT 'welcome', 'Welcome to LiveAuction!\nStart bidding now and win amazing prizes.\nDial *855*22# to begin!', TRUE, 1
WHERE NOT EXISTS (SELECT 1 FROM sms_templates WHERE transaction_type = 'welcome' AND display_order = 1);

INSERT INTO sms_templates (transaction_type, template_text, is_active, display_order) 
SELECT 'welcome', 'Welcome! Ready to bid?\nJoin the action and place your bids.\nDial *855*22# now!', TRUE, 2
WHERE NOT EXISTS (SELECT 1 FROM sms_templates WHERE transaction_type = 'welcome' AND display_order = 2);

INSERT INTO sms_templates (transaction_type, template_text, is_active, display_order) 
SELECT 'welcome', 'Welcome to LiveAuction!\nYour chance to win starts here.\nDial *855*22# to get started!', TRUE, 3
WHERE NOT EXISTS (SELECT 1 FROM sms_templates WHERE transaction_type = 'welcome' AND display_order = 3);

EXIT;
```

## Step 4: Verify Database Changes
```bash
mysql -u auction_user -p auction -e "SELECT transaction_type, COUNT(*) as count FROM sms_templates GROUP BY transaction_type;"
```

Expected output should show:
- welcome: 3 templates
- bid_success: templates (from old bid_fee, bid, other)
- payment_failed: templates (from old payment_failed, payment_cancelled)

## Step 5: Rebuild Frontend
```bash
cd /var/www/auctionorwhat
npm run build
```

**Note:** If you get errors, try:
```bash
npm install
npm run build
```

## Step 6: Reload PHP-FPM
```bash
sudo systemctl reload php8.3-fpm
```

## Step 7: Verify Services are Running
```bash
# Check PHP-FPM status
sudo systemctl status php8.3-fpm

# Check Nginx status
sudo systemctl status nginx

# Test Nginx config
sudo nginx -t
```

## Step 8: Test the Changes

### 8a. Test SMS Template API
```bash
curl -X GET https://lightfast.goldentranscripts.net/api/admin/sms-templates \
  -H "Cookie: $(cat /path/to/your/session/cookie)" \
  | jq '.'
```

### 8b. Check Logs for Welcome SMS
```bash
# Watch for welcome SMS when first-time user dials
sudo tail -f /var/log/ussd_errors.log | grep -i "welcome\|first"
```

### 8c. Test M-Pesa Callback (if you have test transactions)
```bash
# Watch callback logs
sudo tail -f /var/log/ussd_errors.log | grep -i "callback\|sms\|template"
```

## Step 9: Verify Frontend Access
1. Open browser: `https://lightfast.goldentranscripts.net`
2. Login to admin dashboard
3. Navigate to USSD Simulator
4. Scroll down to "SMS Autoresponse Templates" section
5. Verify you see 3 tabs: Welcome, Bid Success, Payment Failed

## Step 10: Optional - Clear Browser Cache
If you see old UI, clear browser cache or use incognito mode.

## Troubleshooting

### If database migration fails:
```bash
# Check current table structure
mysql -u auction_user -p auction -e "DESCRIBE sms_templates;"

# Check existing data
mysql -u auction_user -p auction -e "SELECT transaction_type, COUNT(*) FROM sms_templates GROUP BY transaction_type;"
```

### If PHP-FPM fails to reload:
```bash
# Check PHP-FPM error log
sudo tail -f /var/log/php8.3-fpm.log

# Restart PHP-FPM instead
sudo systemctl restart php8.3-fpm
```

### If frontend build fails:
```bash
# Check Node version
node --version  # Should be v18 or higher

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### If templates not showing in UI:
```bash
# Check API response
curl https://lightfast.goldentranscripts.net/api/admin/sms-templates

# Check browser console for errors (F12)
```

## Summary of Changes Deployed

1. ✅ SMS Template Management System
   - Database table for templates
   - API endpoints for CRUD operations
   - Frontend UI in USSD Simulator

2. ✅ Simplified to 3 Categories
   - Welcome (first-time dial)
   - Bid Success (all successful payments)
   - Payment Failed (all failures/cancellations)

3. ✅ Welcome SMS on First Dial
   - Detects first-time users
   - Sends welcome message automatically

4. ✅ Updated M-Pesa Callbacks
   - Uses templates from database
   - Randomizes messages from active templates

## Post-Deployment Checklist

- [ ] Database migrations completed
- [ ] Frontend rebuilt successfully
- [ ] PHP-FPM reloaded
- [ ] Templates visible in UI (3 tabs)
- [ ] Welcome SMS sends on first dial (test with new number)
- [ ] Bid success SMS sends on payment (test with payment)
- [ ] Payment failed SMS sends on failure (test with cancelled payment)
