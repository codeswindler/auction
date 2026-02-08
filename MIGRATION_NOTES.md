# Migration Notes: Node.js to PHP

## What Changed

### Backend Conversion
- **Node.js/Express** → **PHP 8.3**
- **SQL ORM** → **MariaDB/PDO**
- **TypeScript** → **PHP**
- All API endpoints maintained same paths and responses

### File Structure Changes

#### New PHP Files
- `api/config.php` - Database configuration and helpers
- `api/Storage.php` - Database storage layer (replaces `server/storage.ts`)
- `api/ussd_handler.php` - USSD logic (replaces `server/routes.ts` USSD handler)
- `api/ussd.php` - USSD gateway endpoint (GET)
- `api/ussd_simulator.php` - USSD simulator endpoint (POST)
- `api/users.php` - User API endpoint
- `api/admin.php` - Admin API endpoints
- `api/index.php` - API router
- `index.php` - Main entry point for serving frontend

#### Database
- `database/migrations.sql` - MariaDB schema (replaces Drizzle schema)
- Same table structure: users, transactions, ussd_sessions

#### Configuration
- `env.example` - Environment template (replaces Node.js .env)
- `.htaccess` - Apache/PHP configuration
- `deployment/nginx.conf` - Nginx configuration
- `deployment/deploy.sh` - Deployment script

#### Build Changes
- `script/build.ts` - Updated to only build frontend (no Node.js server build)

### What Stayed the Same

- **Frontend**: React app unchanged (works with PHP backend)
- **API Endpoints**: Same paths and response formats
- **Database Schema**: Same structure (converted to SQL)
- **USSD Logic**: Same business logic, converted to PHP

## Key Differences

### Database
- **After**: MariaDB/MySQL with PDO

### Environment Variables
- **After**: `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS` (separate values)

### Deployment
- **Before**: Node.js process (PM2/systemd)
- **After**: PHP-FPM with Nginx

### API Routing
- **Before**: Express.js routes
- **After**: PHP files with regex routing

## Testing Checklist

- [ ] USSD gateway endpoint works
- [ ] USSD simulator works
- [ ] User API works
- [ ] Admin endpoints work
- [ ] Frontend loads correctly
- [ ] Database operations work
- [ ] Session management works
- [ ] Transactions are created correctly

## Deployment Steps

1. Set up MariaDB database
2. Run `database/migrations.sql`
3. Configure `.env` file
4. Build frontend: `npm run build`
5. Deploy to `/var/www/ussd`
6. Configure Nginx
7. Set permissions
8. Test endpoints

See `README.md` and `deployment/CHECKLIST.md` for detailed instructions.

