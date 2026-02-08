# How to Block Telegram Alerts from Your End

## Understanding the Problem

The Telegram alerts are likely coming from an external service that monitors M-Pesa transactions directly via M-Pesa's API, **not through your callback endpoint**. However, we can still implement security measures to:

1. **Identify the source** of any unauthorized requests
2. **Secure your callback endpoint** to prevent data leakage
3. **Monitor incoming requests** to detect suspicious activity

## Solutions Implemented

### 1. Enhanced Callback Logging
We've added detailed logging to the callback endpoint to track:
- Source IP addresses
- User-Agent strings
- Request headers
- All incoming data

This will help identify if any external services are accessing your callback endpoint.

### 2. IP Whitelisting (Optional)
You can restrict the callback endpoint to only accept requests from M-Pesa's official IP addresses.

**To enable:**
1. Contact Safaricom to get their official IP ranges for callbacks
2. Uncomment the IP whitelist code in `api/mpesa_callback.php`
3. Add the official M-Pesa IP addresses

**Note:** Be careful with this - if M-Pesa IPs change, your callbacks will stop working.

## Additional Steps You Can Take

### 3. Monitor Server Logs
On your Contabo server, monitor incoming requests:

```bash
# Monitor callback endpoint access
sudo tail -f /var/log/nginx/jengacapital_access.log | grep "/api/mpesa/callback"

# Check PHP error logs for callback activity
sudo tail -f /var/log/ussd_errors.log | grep "CALLBACK SECURITY"

# Check for suspicious IPs
sudo grep "/api/mpesa/callback" /var/log/nginx/jengacapital_access.log | awk '{print $1}' | sort | uniq -c | sort -rn
```

### 4. Add Nginx IP Restrictions
You can add IP restrictions at the Nginx level:

```nginx
# In /etc/nginx/sites-available/jengacapital.co.ke
location /api/mpesa/callback {
    # Allow only M-Pesa IPs (get these from Safaricom)
    # allow 196.201.214.200;
    # allow 196.201.214.206;
    # deny all;
    
    try_files $uri $uri/ /api/index.php?$query_string;
    
    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
}
```

**After modifying Nginx config:**
```bash
sudo nginx -t  # Test configuration
sudo systemctl reload nginx  # Reload Nginx
```

### 5. Check for Active Monitoring Services
Check if there are any services on your server that might be forwarding data:

```bash
# Check for Telegram-related processes
ps aux | grep -i telegram
ps aux | grep -i bot

# Check for webhook forwarding services
ps aux | grep -i webhook
ps aux | grep -i forward

# Check cron jobs
crontab -l
sudo crontab -l -u www-data

# Check for any scripts that might be monitoring
find /var/www -name "*telegram*" -o -name "*mpesa*monitor*"
```

### 6. Database Monitoring
Check if there are any database triggers or external services querying your database:

```sql
-- Check for triggers
SHOW TRIGGERS;

-- Check for active connections
SHOW PROCESSLIST;

-- Check for external database access
SELECT * FROM information_schema.PROCESSLIST WHERE USER != 'ussd_user';
```

## Important Limitations

**⚠️ Critical Understanding:**

If the Telegram service is monitoring M-Pesa transactions **directly via M-Pesa's API** (not through your callback), you **cannot block it from your server**. The service would be:

1. Using M-Pesa Business Portal API credentials
2. Querying M-Pesa's transaction API directly
3. Receiving webhooks from M-Pesa configured in the Business Portal

**In this case, you MUST:**
- Contact Safaricom Business Support
- Request removal of all external integrations
- Disable webhooks in M-Pesa Business Portal
- Revoke any API credentials the previous developer may have shared

## Verification Steps

After implementing these measures:

1. **Monitor logs** for a few days to identify patterns
2. **Check if callback requests** are coming from unauthorized IPs
3. **Verify M-Pesa callbacks** still work correctly
4. **Document any suspicious activity** for Safaricom support

## Next Steps

1. ✅ Deploy the enhanced logging (already done in code)
2. ⏳ Monitor logs for 24-48 hours to identify patterns
3. ⏳ Contact Safaricom with findings
4. ⏳ Request removal of external integrations

## Contact Information

**Safaricom Business Support:**
- Phone: +254 722 002 100
- Email: business@mpesa.co.ke

**What to tell them:**
- Paybill number: 4003863
- Issue: Unauthorized Telegram alerts for all payments
- Request: Remove all external webhook/notification integrations
- Request: List all active API integrations for this paybill

