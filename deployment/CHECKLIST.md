# Deployment Checklist

## Pre-Deployment

- [ ] Server: Contabo VPS (157.173.114.45)
- [ ] OS: Ubuntu 22.04/24.04
- [ ] Domain: jengacapital.co.ke (DNS active on Cloudflare)
- [ ] SSH access configured

## Server Setup

### 1. Install Required Software

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install PHP 8.3 FPM and extensions
sudo apt install -y php8.3-fpm php8.3-mysql php8.3-curl php8.3-mbstring php8.3-xml php8.3-json

# Install MariaDB
sudo apt install -y mariadb-server mariadb-client

# Install Nginx
sudo apt install -y nginx

# Install Node.js (for building frontend)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Database Setup

```bash
# Secure MariaDB installation
sudo mysql_secure_installation

# Create database and user
sudo mysql -u root -p
```

```sql
CREATE DATABASE ussd_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ussd_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON ussd_db.* TO 'ussd_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

```bash
# Run migrations
mysql -u ussd_user -p ussd_db < /var/www/ussd/database/migrations.sql
```

### 3. Deploy Application

```bash
# Clone or upload project to /var/www/ussd
cd /var/www
sudo git clone <repository-url> ussd
# OR upload via SCP/SFTP

# Set permissions
cd /var/www/ussd
sudo chown -R www-data:www-data /var/www/ussd
sudo chmod 755 /var/www/ussd/api/*.php
sudo chmod 755 /var/www/ussd/index.php

# Create logs directory
sudo mkdir -p /var/www/ussd/logs
sudo chown -R www-data:www-data /var/www/ussd/logs
sudo chmod 755 /var/www/ussd/logs
```

### 4. Configure Environment

```bash
cd /var/www/ussd
sudo cp env.example .env
sudo nano .env
```

Update with:
- DB_HOST=localhost
- DB_NAME=ussd_db
- DB_USER=ussd_user
- DB_PASS=(your password)

```bash
# Secure .env file
sudo chmod 600 .env
sudo chown www-data:www-data .env
```

### 5. Build Frontend

```bash
cd /var/www/ussd
npm install
npm run build
```

### 6. Configure Nginx

```bash
# Copy nginx config
sudo cp /var/www/ussd/deployment/nginx.conf /etc/nginx/sites-available/jengacapital.co.ke

# Enable site
sudo ln -s /etc/nginx/sites-available/jengacapital.co.ke /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 7. Configure PHP-FPM

```bash
# Edit PHP-FPM pool config
sudo nano /etc/php/8.3/fpm/pool.d/www.conf
```

Set:
```
request_terminate_timeout = 30s
```

```bash
# Restart PHP-FPM
sudo systemctl restart php8.3-fpm
```

### 8. SSL Setup (Optional but Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d jengacapital.co.ke -d www.jengacapital.co.ke

# Test auto-renewal
sudo certbot renew --dry-run
```

### 9. Firewall Configuration

```bash
# Allow required ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp # HTTPS

# Enable firewall
sudo ufw enable
sudo ufw status
```

## Post-Deployment Testing

- [ ] Test USSD endpoint: `http://jengacapital.co.ke/api/ussd?MSISDN=0700000000&SESSIONID=test123&USSDCODE=*519*65#&INPUT=*519*65#`
- [ ] Test simulator: POST to `http://jengacapital.co.ke/api/ussd/simulator`
- [ ] Test frontend: `http://jengacapital.co.ke`
- [ ] Test admin: `http://jengacapital.co.ke/admin`
- [ ] Verify database connections
- [ ] Check PHP error logs: `/var/log/php8.3-fpm.log`
- [ ] Check Nginx error logs: `/var/log/nginx/jengacapital_error.log`

## Important Notes

1. **USSD Direct Connection**: Ensure USSD gateway can reach server directly (no Cloudflare proxy for `/api/ussd`)
2. **PHP Timeout**: Set to 30+ seconds for USSD sessions
3. **Database Encoding**: Use utf8mb4 for proper character support
4. **File Permissions**: www-data user must own project files
5. **Logs Directory**: Must be writable by www-data

## Troubleshooting

### Database Connection Issues
```bash
# Test connection
mysql -u ussd_user -p ussd_db

# Check MariaDB status
sudo systemctl status mariadb
```

### PHP Errors
```bash
# Check PHP-FPM logs
sudo tail -f /var/log/php8.3-fpm.log

# Check PHP version and extensions
php -v
php -m
```

### Nginx Issues
```bash
# Test configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Check access logs
sudo tail -f /var/log/nginx/jengacapital_access.log
```

### Permission Issues
```bash
# Fix ownership
sudo chown -R www-data:www-data /var/www/ussd

# Fix permissions
sudo find /var/www/ussd -type d -exec chmod 755 {} \;
sudo find /var/www/ussd -type f -exec chmod 644 {} \;
sudo chmod 755 /var/www/ussd/api/*.php
sudo chmod 755 /var/www/ussd/index.php
```

