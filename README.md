# Jenga Capital USSD Application

A USSD banking application built with PHP backend and React frontend.

## Stack

- **Backend**: PHP 8.3 with PDO (MariaDB/MySQL)
- **Frontend**: React + TypeScript + Vite
- **Database**: MariaDB 10.6+ (MySQL compatible)
- **Web Server**: Nginx with PHP-FPM

## Project Structure

```
jengacapital/
├── api/                 # PHP backend API endpoints
│   ├── config.php      # Database configuration
│   ├── Storage.php     # Database storage layer
│   ├── ussd_handler.php # USSD logic
│   ├── ussd.php        # USSD gateway endpoint (GET)
│   ├── ussd_simulator.php # USSD simulator endpoint (POST)
│   ├── users.php       # User API
│   ├── admin.php       # Admin API
│   └── index.php       # API router
├── client/             # React frontend source
├── public/             # Built frontend (generated)
├── database/           # Database migrations
├── deployment/         # Deployment configurations
├── index.php           # Main entry point
└── .env                # Environment configuration
```

## Setup Instructions

### 1. Server Requirements

- Ubuntu 22.04/24.04
- PHP 8.3 FPM (with curl, mysql, mbstring, xml, json extensions)
- MariaDB 10.6+ or MySQL 8.0+
- Nginx 1.18+
- Node.js 18+ (for building frontend)

### 2. Database Setup

**For Local Development and Production:**
- Use MariaDB/MySQL (see `DEPLOYMENT.md` and `env.example.production`)

**Local MariaDB Setup:**
```bash
# Create database and user
mysql -u root -p < database/migrations.sql

# Or manually:
mysql -u root -p
CREATE DATABASE ussd_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ussd_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON ussd_db.* TO 'ussd_user'@'localhost';
FLUSH PRIVILEGES;
```

### 3. Configuration

```bash
# Copy environment template
cp env.example .env

# Edit .env with your database credentials
nano .env
```

Required environment variables:
- `DB_HOST` - Database host (usually localhost)
- `DB_NAME` - Database name (ussd_db)
- `DB_USER` - Database user (ussd_user)
- `DB_PASS` - Database password

### 4. Build Frontend

```bash
# Install dependencies
npm install

# Build frontend
npm run build

# This will create the public/ directory with built files
```

### 5. Deploy to Server

```bash
# Clone or upload to /var/www/ussd
cd /var/www/ussd

# Set permissions
chown -R www-data:www-data /var/www/ussd
chmod 755 /var/www/ussd/api/*.php
chmod 755 /var/www/ussd/index.php

# Create logs directory
mkdir -p logs
chown -R www-data:www-data logs
```

### 6. Nginx Configuration

```bash
# Copy nginx config
sudo cp deployment/nginx.conf /etc/nginx/sites-available/jengacapital.co.ke

# Enable site
sudo ln -s /etc/nginx/sites-available/jengacapital.co.ke /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 7. PHP-FPM Configuration

Ensure PHP-FPM timeout is set for USSD (30+ seconds):

```bash
# Edit PHP-FPM config
sudo nano /etc/php/8.3/fpm/pool.d/www.conf

# Set:
request_terminate_timeout = 30s
```

Restart PHP-FPM:
```bash
sudo systemctl restart php8.3-fpm
```

### 8. SSL Setup (Optional but Recommended)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d jengacapital.co.ke -d www.jengacapital.co.ke

# Auto-renewal is set up automatically
```

## API Endpoints

### USSD Gateway (Real)
- **GET** `/api/ussd?MSISDN=...&SESSIONID=...&USSDCODE=...&INPUT=...`
- Returns: `text/plain` (CON/END format)

### USSD Simulator (Testing)
- **POST** `/api/ussd/simulator`
- Body: `{ "phoneNumber": "...", "text": "...", "sessionId": "..." }`
- Returns: `{ "message": "...", "type": "CON|END" }`

### User API
- **GET** `/api/users/:phoneNumber`
- Returns: User data

### Admin API
- **GET** `/api/admin/users` - List all users
- **GET** `/api/admin/users/:id` - Get user details
- **GET** `/api/admin/transactions` - List all transactions

## Development

### Local Development

1. Install dependencies: `npm install`
2. Set up local MariaDB/MySQL database
3. Copy `env.example` to `.env` and configure database credentials
4. Build frontend: `npm run build`
5. Use PHP built-in server or configure local Nginx/Apache

### PHP Built-in Server (Testing)

```bash
php -S localhost:8000 -t public public/index.php
```

## USSD Code

- **Code**: `*123#`
- **Gateway**: Direct connection (no Cloudflare proxy for USSD endpoint)

## Security Notes

- Never commit `.env` file
- Use strong database passwords
- Keep PHP and server software updated
- Configure firewall (ports 22, 80, 443)
- Use SSL/TLS in production

## Troubleshooting

### Database Connection Issues
- Check `.env` file exists and has correct credentials
- Verify database user has proper permissions
- Check MariaDB is running: `sudo systemctl status mariadb`

### PHP Errors
- Check PHP error logs: `/var/log/php8.3-fpm.log`
- Verify PHP extensions are installed: `php -m`
- Check file permissions

### Nginx Issues
- Test config: `sudo nginx -t`
- Check error logs: `/var/log/nginx/error.log`
- Verify PHP-FPM socket: `/var/run/php/php8.3-fpm.sock`

## License

MIT

