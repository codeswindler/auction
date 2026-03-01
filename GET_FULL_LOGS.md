# How to Get Full Session Logs

## 1. STK Push Logs (to see why STK push is failing)

```bash
# View real-time STK push logs
sudo tail -f /var/log/stk_push.log

# View last 100 lines
sudo tail -n 100 /var/log/stk_push.log

# View all STK push errors
sudo grep -i "error\|failed\|fail" /var/log/stk_push.log | tail -50

# View specific transaction
sudo grep "TX ID=1223" /var/log/stk_push.log
```

## 2. USSD Menu Navigation Logs (to see menu errors)

```bash
# View real-time USSD debug logs
sudo tail -f /var/log/ussd_debug.log

# View last 100 lines
sudo tail -n 100 /var/log/ussd_debug.log

# View menu errors
sudo grep -i "MENU ERROR\|Invalid selection\|navigation" /var/log/ussd_debug.log | tail -50

# View specific phone number session
sudo grep "254729265412" /var/log/ussd_debug.log | tail -20
```

## 3. PHP Error Logs (general errors)

```bash
# View PHP errors
sudo tail -f /var/log/php8.3-fpm.log

# View USSD-related errors
sudo grep -i "ussd\|stk\|mpesa" /var/log/php8.3-fpm.log | tail -100

# View all errors from last hour
sudo grep "$(date '+%Y-%m-%d %H')" /var/log/php8.3-fpm.log | grep -i error
```

## 4. Complete Session Trace (for a specific phone number)

```bash
# Replace PHONE_NUMBER with the actual phone (e.g., 254729265412)
PHONE_NUMBER="254729265412"

# Get all logs for this phone
echo "=== USSD Debug Log ==="
sudo grep "$PHONE_NUMBER" /var/log/ussd_debug.log

echo -e "\n=== STK Push Log ==="
sudo grep "$PHONE_NUMBER" /var/log/stk_push.log

echo -e "\n=== PHP Error Log ==="
sudo grep "$PHONE_NUMBER" /var/log/php8.3-fpm.log
```

## 5. Export Full Logs to File

```bash
# Export all logs from last hour to a file
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
LOG_FILE="/tmp/full_logs_${TIMESTAMP}.txt"

{
    echo "=== STK Push Logs ==="
    sudo tail -n 200 /var/log/stk_push.log
    echo -e "\n=== USSD Debug Logs ==="
    sudo tail -n 200 /var/log/ussd_debug.log
    echo -e "\n=== PHP Errors (USSD/STK related) ==="
    sudo grep -i "ussd\|stk\|mpesa" /var/log/php8.3-fpm.log | tail -100
} > "$LOG_FILE"

echo "Logs exported to: $LOG_FILE"
```

## 6. Monitor All Logs in Real-Time (Multiple Terminals)

**Terminal 1 - STK Push:**
```bash
sudo tail -f /var/log/stk_push.log
```

**Terminal 2 - USSD Debug:**
```bash
sudo tail -f /var/log/ussd_debug.log
```

**Terminal 3 - PHP Errors:**
```bash
sudo tail -f /var/log/php8.3-fpm.log | grep -i "ussd\|stk\|error"
```

## What to Look For:

### STK Push Failures:
- Look for "M-Pesa STK Push Response" to see M-Pesa's error message
- Check for "ResponseCode" other than "0"
- Look for "ResponseDescription" which explains the failure

### Menu Navigation Errors:
- Look for "MENU ERROR" entries
- Check "Selection out of range" errors
- Look for "Invalid non-numeric selection" errors
