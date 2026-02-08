# M-Pesa Callback Analysis

## Findings from Security Logs

### Legitimate M-Pesa Callbacks Detected

**IP Addresses:**
- `196.201.212.69` ✅ (M-Pesa official IP)
- `196.201.214.200` ✅ (M-Pesa official IP)

**User-Agent:** `ReactorNetty/1.3.0` ✅ (M-Pesa's callback service)

**Headers:**
- `Businessshortcode: 4003863` ✅ (Correct paybill)
- `Content-Type: application/json;charset=UTF-8` ✅

## Conclusion

✅ **Your callback endpoint is receiving legitimate M-Pesa callbacks only**

❌ **The Telegram alerts are NOT coming through your callback endpoint**

## What This Means

The Telegram alerts are being generated from **outside your system**, likely:

1. **M-Pesa Business Portal Webhook Configuration**
   - A webhook configured in the Business Portal that forwards to Telegram
   - This happens at M-Pesa's infrastructure level, not your server

2. **Third-Party Service with API Access**
   - A service (like Prasams or similar) that has M-Pesa API credentials
   - Monitoring transactions via M-Pesa's transaction query API
   - Forwarding alerts to Telegram

3. **M-Pesa Notification Service**
   - A notification service configured in the Business Portal
   - Automatically sends alerts for all paybill transactions

## Action Required

Since the alerts are NOT coming through your callback endpoint, you **must** contact Safaricom to remove the integration:

**Contact Safaricom Business Support:**
- Phone: +254 722 002 100
- Email: business@mpesa.co.ke

**Tell them:**
- Paybill: 4003863
- Issue: Unauthorized Telegram alerts for all payments
- Evidence: Callbacks are legitimate (IPs: 196.201.212.69, 196.201.214.200)
- Request: Remove all external webhook/notification integrations from Business Portal
- Request: List all active notification services for this paybill

## Optional: IP Whitelisting

Since we've identified M-Pesa's official IPs, you can optionally whitelist them in `api/mpesa_callback.php`:

```php
$allowedIps = [
    '196.201.212.69',
    '196.201.214.200',
    // Add more M-Pesa IPs as you discover them
];
```

However, this won't stop Telegram alerts since they're not coming through your callback.

