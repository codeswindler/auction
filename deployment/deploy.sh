#!/bin/bash
# Deployment script for Jenga Capital USSD
# Run as root or with sudo

set -e

PROJECT_DIR="/var/www/ussd"
WEB_USER="www-data"

echo "Deploying Jenga Capital USSD..."

# 1. Navigate to project directory
cd $PROJECT_DIR

# 2. Pull latest code (if using git)
# git pull origin main

# 3. Set permissions
echo "Setting permissions..."
chown -R $WEB_USER:$WEB_USER $PROJECT_DIR
find $PROJECT_DIR -type d -exec chmod 755 {} \;
find $PROJECT_DIR -type f -exec chmod 644 {} \;
chmod 755 $PROJECT_DIR/api/*.php
chmod 755 $PROJECT_DIR/index.php

# 4. Create logs directory if it doesn't exist
mkdir -p $PROJECT_DIR/logs
chown -R $WEB_USER:$WEB_USER $PROJECT_DIR/logs
chmod 755 $PROJECT_DIR/logs

# 5. Ensure .env file exists
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "Warning: .env file not found. Please create it from .env.example"
fi

# 6. Build frontend (if needed)
if [ -f "$PROJECT_DIR/package.json" ]; then
    echo "Building frontend..."
    cd $PROJECT_DIR
    npm install
    npm run build
    # Move built files to public directory
    if [ -d "$PROJECT_DIR/dist/public" ]; then
        cp -r $PROJECT_DIR/dist/public/* $PROJECT_DIR/public/
    fi
fi

# 7. Run database migrations (if needed)
# mysql -u ussd_user -p ussd_db < $PROJECT_DIR/database/migrations.sql

# 8. Restart PHP-FPM
echo "Restarting PHP-FPM..."
systemctl restart php8.3-fpm

# 9. Reload Nginx
echo "Reloading Nginx..."
nginx -t && systemctl reload nginx

echo "Deployment complete!"

