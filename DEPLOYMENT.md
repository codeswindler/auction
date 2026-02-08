# Deployment Guide for Contabo VPS

## Server Specifications
- **Provider**: Contabo VPS
- **IP**: 157.173.114.45
- **OS**: Ubuntu 22.04 LTS
- **Web Server**: Nginx 1.18+
- **PHP**: 8.3 FPM
- **Database**: MariaDB 10.6+
- **Domain**: jengacapital.co.ke
- **Project Path**: `/var/www/ussd`

## Step 1: Clone Repository

```bash
cd /var/www
git clone https://github.com/your-username/jenga-capital.git ussd
cd ussd
```

## Step 2: Setup MariaDB Database

⚠️ **IMPORTANT**: Production uses **MariaDB**.

```bash
# Install MariaDB (if not already installed)
sudo apt update
sudo apt install -y mariadb-server

# Create database and user
sudo mysql -u root
```

In MySQL prompt:
```sql
CREATE DATABASE ussd_jenga CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ussd_user'@'localhost' IDENTIFIED BY 'your_strong_password';
GRANT ALL PRIVILEGES ON ussd_jenga.* TO 'ussd_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## Step 3: Run Database Migrations

```bash
cd /var/www/ussd
mysql -u ussd_user -p ussd_jenga < database/migrations.sql
mysql -u ussd_user -p ussd_jenga < database/add-payment-fields.sql
mysql -u ussd_user -p ussd_jenga < database/add-fee-transactions-mysql.sql
```

## Step 4: Configure Environment Variables

```bash
cp env.example.production .env
nano .env
```

Fill in your actual values:
```env
DB_HOST=127.0.0.1
DB_NAME=ussd_jenga
DB_USER=ussd_user
DB_PASS=your_actual_password

APP_ENV=production
APP_DEBUG=false

ADMIN_USERNAME=your_admin
ADMIN_PASSWORD=your_strong_password

SESSION_SECRET=very-long-random-string
```

## Step 5: Install PHP Dependencies

Ensure PHP extensions are installed:
```bash
sudo apt install -y php8.3-fpm php8.3-mysql php8.3-mbstring php8.3-xml php8.3-cli
```

## Step 6: Build Frontend

```bash
# Install Node.js (if not installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Build frontend
cd /var/www/ussd
npm install
npm run build
```

## Step 7: Configure Nginx

Create Nginx config:
```bash
sudo nano /etc/nginx/sites-available/jengacapital
```

Paste this configuration:
```nginx
server {
    listen 80;
    server_name jengacapital.co.ke www.jengacapital.co.ke;
    
    # Redirect HTTP to HTTPS (after SSL setup)
    # return 301 https://$server_name$request_uri;

    root /var/www/ussd/client/dist;
    index index.html;

    # Frontend - React app
    location / {
        try_files $uri $uri/ /index.html;
    }

    # PHP API endpoints
    location /api/ {
        root /var/www/ussd;
        try_files $uri /api/index.php?$query_string;
        
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root/api/index.php;
        include fastcgi_params;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/jengacapital /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 8: Set Permissions

```bash
sudo chown -R www-data:www-data /var/www/ussd
sudo chmod -R 755 /var/www/ussd
sudo chmod 600 /var/www/ussd/.env
```

## Step 9: Setup SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d jengacapital.co.ke -d www.jengacapital.co.ke
```

## Step 10: Configure Advanta USSD Gateway

In your Advanta portal, set:
- **USSD URL**: `https://jengacapital.co.ke/api/ussd`
- **Method**: GET or POST (both supported)

## Step 11: Test

1. **Test USSD endpoint** (should return CON message):
   ```bash
   curl "https://jengacapital.co.ke/api/ussd?MSISDN=254700000000&SESSIONID=test123&USSDCODE=*519*65#&INPUT=*519*65#"
   ```

2. **Test admin login**: Visit `https://jengacapital.co.ke` and log in

3. **Test simulator**: After login, go to simulator

## Troubleshooting

- **Check PHP-FPM status**: `sudo systemctl status php8.3-fpm`
- **Check Nginx logs**: `sudo tail -f /var/log/nginx/error.log`
- **Check PHP logs**: `sudo tail -f /var/log/php8.3-fpm.log`
- **Test database connection**: Create a test PHP file in `/var/www/ussd/api/test-db.php`:
  ```php
  <?php
  require_once 'config.php';
  echo "Database connected: " . ($pdo ? "YES" : "NO");
  ```

## Updating Code

```bash
cd /var/www/ussd
git pull
npm run build
sudo systemctl reload php8.3-fpm
sudo systemctl reload nginx
```

