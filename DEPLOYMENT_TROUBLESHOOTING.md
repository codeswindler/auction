# Deployment Troubleshooting Guide

## "Not Found" Error on jengacapital.co.ke

If you see "Not Found" when accessing the site, it means the frontend hasn't been built or the `public` directory is missing.

### Quick Fix:

```bash
cd /var/www/ussd

# 1. Check if public directory exists
ls -la public/

# 2. If public is empty or missing, build the frontend:
cd client
npm install
npm run build
cd ..

# 3. Verify build output exists
ls -la dist/public/
ls -la public/

# 4. If public is still empty, copy from dist:
cp -r dist/public/* public/

# 5. Check permissions
chown -R www-data:www-data public/
chmod -R 755 public/

# 6. Restart PHP-FPM
sudo systemctl restart php8.3-fpm

# 7. Test
curl http://localhost/
```

### Verify index.html exists:

```bash
ls -la /var/www/ussd/public/index.html
cat /var/www/ussd/public/index.html | head -20
```

If the file doesn't exist, the build failed or wasn't run.

### Check Nginx/Apache Configuration:

Make sure your web server is pointing to `/var/www/ussd` and that `index.php` is the default file.

### Common Issues:

1. **Node.js not installed on server**: Install Node.js 18+ and npm
2. **Build fails**: Check for errors in `npm run build` output
3. **Permissions**: Ensure `www-data` user can read the `public` directory
4. **Missing dependencies**: Run `npm install` in the `client` directory

