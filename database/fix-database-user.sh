#!/bin/bash
# Fix database user permissions
# Run as: sudo bash database/fix-database-user.sh

echo "Fixing database user permissions..."

# Read credentials from .env
if [ -f "/var/www/ussd/.env" ]; then
    DB_NAME=$(grep "^DB_NAME=" /var/www/ussd/.env | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
    DB_USER=$(grep "^DB_USER=" /var/www/ussd/.env | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
    DB_PASS=$(grep "^DB_PASS=" /var/www/ussd/.env | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
    
    if [ -z "$DB_NAME" ]; then DB_NAME="ussd_jenga"; fi
    if [ -z "$DB_USER" ]; then DB_USER="ussd_user"; fi
    if [ -z "$DB_PASS" ]; then DB_PASS="willrocks"; fi
else
    DB_NAME="ussd_jenga"
    DB_USER="ussd_user"
    DB_PASS="willrocks"
fi

echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

echo "You will be prompted for MySQL root password."
echo ""

# Create/fix user and grant permissions
mysql -u root -p <<EOF
-- Drop user if exists (to recreate with correct password)
DROP USER IF EXISTS '${DB_USER}'@'localhost';

-- Create user with password
CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';

-- Grant all privileges on the database
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';

-- Flush privileges
FLUSH PRIVILEGES;

-- Verify user exists
SELECT User, Host FROM mysql.user WHERE User = '${DB_USER}';

-- Show grants
SHOW GRANTS FOR '${DB_USER}'@'localhost';
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Database user fixed successfully!"
    echo ""
    echo "Testing connection..."
    mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT 1 as test;" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✓ Connection test successful!"
    else
        echo "✗ Connection test failed. Check password."
    fi
else
    echo ""
    echo "✗ Failed to fix database user."
    exit 1
fi

