# How to Add Another Admin User

## Step 1: Run Database Migration

First, create the `admins` table in your database:

### For Production (Contabo - MariaDB/MySQL):
```bash
cd /var/www/ussd
mysql -u ussd_user -p ussd_jenga < database/add-admins-table.sql
```

**Note:** The migration will create the `admins` table and insert a default admin user:
- Username: `admin`
- Password: `admin123`

## Step 2: Add New Admin User

### Option A: Using the Admin Dashboard (Recommended)

1. Log into the admin dashboard
2. Navigate to Admin Management section (if available in UI)
3. Use the "Add Admin" form to create a new admin user

### Option B: Using API Endpoint

Make a POST request to `/api/admin/admins`:

```bash
curl -X POST https://jengacapital.co.ke/api/admin/admins \
  -H "Content-Type: application/json" \
  -H "Cookie: PHPSESSID=your_session_id" \
  -d '{
    "username": "newadmin",
    "password": "securepassword123"
  }'
```

**Requirements:**
- Username: 3-50 characters, alphanumeric, underscores, dashes only
- Password: Minimum 8 characters

### Option C: Direct Database Insert

If you prefer to add directly via database:

```sql
-- Generate password hash (use PHP or online tool)
-- Example hash for password "mypassword123"
INSERT INTO admins (username, password_hash, is_active) 
VALUES ('newadmin', '$2y$10$YourGeneratedHashHere', 1);
```

To generate a password hash:
```php
<?php
echo password_hash('your_password_here', PASSWORD_BCRYPT);
?>
```

## Step 3: Verify New Admin

Test login with the new credentials:
1. Log out of current admin session
2. Log in with the new username and password
3. Verify you can access admin endpoints

## Security Notes

- ✅ Passwords are hashed using `password_hash()` with bcrypt
- ✅ Passwords are never stored in plain text
- ✅ Admin users can be deactivated (soft delete) instead of deleted
- ✅ Self-deletion is prevented for safety
- ✅ All admin operations require authentication

## List All Admins

To see all admin users:

```bash
curl -X GET https://jengacapital.co.ke/api/admin/admins \
  -H "Cookie: PHPSESSID=your_session_id"
```

## Deactivate an Admin

To deactivate (soft delete) an admin user:

```bash
curl -X DELETE https://jengacapital.co.ke/api/admin/admins/2 \
  -H "Cookie: PHPSESSID=your_session_id"
```

**Note:** You cannot delete your own account while logged in.

## Migration from Environment Variables

The system supports both:
1. **Database admins** (new method) - Multiple users, stored in database
2. **Environment variables** (legacy) - Single user via `ADMIN_USERNAME` and `ADMIN_PASSWORD`

During migration, both methods work. Once all admins are in the database, you can remove the environment variables.

## Troubleshooting

**"Username already exists"**
- The username is already taken. Choose a different username.

**"Password must be at least 8 characters"**
- Use a password with at least 8 characters.

**"Admin user not found"**
- The admin ID doesn't exist. Check the admin list first.

**Login fails after adding admin**
- Verify the password hash was generated correctly
- Check that `is_active = 1` in the database
- Ensure the database migration ran successfully

