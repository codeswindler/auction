# Admin Users Setup

## Database Migration

Run this migration to create the `admins` table:

```bash
# For MySQL/MariaDB (Production)
mysql -u ussd_user -p ussd_jenga < database/add-admins-table.sql
```

## Table Structure

The `admins` table includes:
- `id` - Primary key
- `username` - Unique username (3-50 characters)
- `password_hash` - Bcrypt hashed password
- `created_at` - Timestamp when user was created
- `last_login` - Timestamp of last login
- `is_active` - Boolean flag for active/inactive status

## Default Admin

The migration creates a default admin user:
- **Username**: `admin`
- **Password**: `admin123` (change this in production!)

## Creating New Admins

1. Only the super admin (defined in `ADMIN_USERNAME` env variable) can create new admins
2. New admins are stored in the database
3. They can log in immediately after creation
4. Login checks the database first, then falls back to env variables

## Verification

After running the migration, verify the table exists:

```sql
-- MySQL/MariaDB
SHOW TABLES LIKE 'admins';
SELECT * FROM admins;
```

