# How to Disable Telegram Alerts for M-Pesa Paybill

## Problem
Telegram alerts are being received for ALL payments to paybill **4003863**, even though the alerts are not configured in our codebase. The alerts show "Auto-captured via MPESA API", indicating an external service is monitoring transactions.

## Solution Steps

### 1. Check M-Pesa Business Portal
**URL:** https://business.m-pesa.co.ke

1. Log in with business account credentials
2. Navigate to: **Settings** → **Notifications** or **Webhooks**
3. Look for:
   - Telegram bot integrations
   - Webhook URLs
   - API notification settings
   - "Auto-capture" or "Auto-notify" settings
4. **Disable or remove** any Telegram/webhook configurations

### 2. Check Third-Party Services
Common services that provide M-Pesa monitoring:
- **Prasams** (https://transactions.prasams.com)
- **M-Pesa API monitoring services**
- **Custom webhook forwarding services**

**Action:** Log into any third-party services linked to paybill 4003863 and disable Telegram notifications.

### 3. Contact Safaricom Business Support
If you cannot access the Business Portal or find the source:

**Contact:**
- **Phone:** +254 722 002 100
- **Email:** business@mpesa.co.ke

**Request:**
- Review all webhooks/notifications linked to paybill **4003863**
- Remove any Telegram bot integrations
- Disable all external notification services
- List all active API integrations for this paybill

### 4. Check Daraja Developer Portal
**URL:** https://developer.safaricom.co.ke

1. Log in with developer account
2. Check your Daraja app settings
3. Verify callback URLs are only: `https://jengacapital.co.ke/api/mpesa/callback`
4. Remove any webhook URLs pointing to Telegram services

### 5. Verify No Active Monitoring Services
Check if there are any services monitoring M-Pesa transactions:

```bash
# On Contabo server, check for active processes
ps aux | grep -i telegram
ps aux | grep -i mpesa
ps aux | grep -i webhook

# Check cron jobs
crontab -l
sudo crontab -l -u www-data

# Check for any external API monitoring scripts
find /var/www -name "*telegram*" -o -name "*mpesa*monitor*"
```

## Important Notes

- The alerts are coming from **outside our codebase** (we confirmed no Telegram code exists)
- The "Auto-captured via MPESA API" message indicates an API-based monitoring service
- This affects **ALL payments** to the paybill, not just transactions from our system
- The previous developer likely set this up in the M-Pesa Business Portal or a third-party service

## Verification

After disabling, test by making a small payment to paybill 4003863 and verify:
- ✅ Payment is processed normally
- ✅ No Telegram alert is received
- ✅ Your system still receives callbacks correctly

## If Alerts Continue

If alerts continue after following these steps:
1. Document the exact time and transaction ID of a test payment
2. Contact Safaricom support with the transaction details
3. Request a complete audit of all integrations linked to paybill 4003863
4. Ask them to disable ALL external notification services

