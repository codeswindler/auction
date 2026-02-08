#!/bin/bash
# Script to create web app log file with proper permissions

# Create the log file
sudo touch /var/log/web_app.log

# Set ownership to www-data (web server user)
sudo chown www-data:www-data /var/log/web_app.log

# Set permissions (read/write for owner, read for group/others)
sudo chmod 644 /var/log/web_app.log

# Verify it was created
if [ -f /var/log/web_app.log ]; then
    echo "✓ Web app log file created successfully at /var/log/web_app.log"
    echo "✓ Permissions set:"
    ls -la /var/log/web_app.log
else
    echo "✗ Failed to create log file"
    exit 1
fi


