# Web App Logs and Timezone Configuration

## 📋 Where to Check Web App Logs

### Production Server (Contabo)
The application logs are written to:
```bash
/var/log/ussd_errors.log
```

### Viewing Logs

#### Real-time log monitoring (tail):
```bash
sudo tail -f /var/log/ussd_errors.log
```

#### View last 100 lines:
```bash
sudo tail -n 100 /var/log/ussd_errors.log
```

#### Search logs for specific errors:
```bash
sudo grep -i "error" /var/log/ussd_errors.log | tail -20
```

#### Search logs for specific transaction IDs:
```bash
sudo grep "Transaction ID" /var/log/ussd_errors.log | tail -20
```

#### Search logs for M-Pesa callbacks:
```bash
sudo grep "M-Pesa Callback" /var/log/ussd_errors.log | tail -20
```

### Other Log Locations

#### PHP-FPM Logs:
```bash
sudo tail -f /var/log/php8.3-fpm.log
# or
sudo tail -f /var/log/php-fpm.log
```

#### Nginx Error Logs:
```bash
sudo tail -f /var/log/nginx/error.log
```

#### Nginx Access Logs:
```bash
sudo tail -f /var/log/nginx/jengacapital_access.log
```

### Development Environment
For local development, logs are written to:
```
logs/ussd_errors.log
```
(relative to project root)

---

## 🌍 Timezone Configuration

### Backend (PHP)
The timezone is set in `api/config.php`:
```php
date_default_timezone_set('Africa/Nairobi');
```

This ensures:
- All PHP `date()` functions use Nairobi timezone (UTC+3)
- Database timestamps are stored correctly
- API responses include Nairobi timezone dates

### Frontend (React/TypeScript)
Transaction dates in the Admin Dashboard are displayed in Nairobi timezone using:
```typescript
new Date(tx.createdAt).toLocaleString("en-KE", { 
  timeZone: "Africa/Nairobi",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit"
})
```

### Database
Ensure your MySQL/MariaDB server timezone is set correctly:
```sql
-- Check current timezone
SELECT @@global.time_zone, @@session.time_zone;

-- Set timezone to Nairobi (if needed)
SET time_zone = '+03:00';
```

---

## 🔍 Common Log Entries

### USSD Requests:
```
[USSD] SessionID: xxx | MSISDN: 254xxx | Response: ...
```

### M-Pesa Callbacks:
```
M-Pesa Callback from IP xxx: {...}
Payment recorded: Transaction ID xxx, Type: Loan, M-Pesa Receipt: xxx
```

### STK Push:
```
STK Push initiated: Transaction ID xxx, CheckoutRequestID: xxx
```

### Admin Actions:
```
New admin created: ID xxx, Username: xxx
Admin login database error: ...
```

### Database Errors:
```
Database connection error: ...
```

---

## 🛠️ Troubleshooting

### If logs are not being written:
1. Check file permissions:
   ```bash
   sudo chmod 666 /var/log/ussd_errors.log
   sudo chown www-data:www-data /var/log/ussd_errors.log
   ```

2. Check PHP error logging is enabled in `api/config.php`

3. Verify the log path exists:
   ```bash
   sudo touch /var/log/ussd_errors.log
   sudo chmod 666 /var/log/ussd_errors.log
   ```

### If dates are showing wrong timezone:
1. Verify `api/config.php` has `date_default_timezone_set('Africa/Nairobi')`
2. Check browser timezone settings
3. Verify database timezone is set correctly
4. Clear browser cache and reload


