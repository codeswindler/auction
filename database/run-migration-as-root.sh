#!/bin/bash
# Alternative migration script using MySQL root user
# Run as: sudo bash database/run-migration-as-root.sh

echo "Running admin table migration using MySQL root user..."
echo "You will be prompted for MySQL root password."

# Read database name from .env if available
if [ -f "/var/www/ussd/.env" ]; then
    DB_NAME=$(grep "^DB_NAME=" /var/www/ussd/.env | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
    if [ -z "$DB_NAME" ]; then
        DB_NAME="ussd_jenga"
    fi
else
    DB_NAME="ussd_jenga"
fi

echo "Using database: $DB_NAME"
echo ""

# Run the migration
mysql -u root -p "$DB_NAME" < /var/www/ussd/database/add-admins-table.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Migration completed successfully!"
    echo ""
    echo "Verifying table..."
    mysql -u root -p "$DB_NAME" -e "SHOW TABLES LIKE 'admins';"
    echo ""
    echo "Listing admin users:"
    mysql -u root -p "$DB_NAME" -e "SELECT id, username, created_at, is_active FROM admins;"
else
    echo ""
    echo "✗ Migration failed. Check the error above."
    exit 1
fi

