# Authentication Setup

The USSD Simulator is protected by admin authentication in production. It remains open during development for easier testing.

## How It Works

### Development Mode
- **No authentication required** - Simulator is accessible to everyone
- Login form is bypassed
- All endpoints work without login

### Production Mode
- **Authentication required** - Simulator requires admin login
- Login form appears before accessing simulator
- API endpoints check authentication

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Admin credentials (CHANGE THESE IN PRODUCTION!)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Session secret (CHANGE THIS IN PRODUCTION!)
SESSION_SECRET=your-secret-key-change-this-in-production

# Application mode
APP_ENV=production
APP_DEBUG=false
```

### Default Credentials

**⚠️ IMPORTANT: Change these before deploying!**

- **Username**: `admin`
- **Password**: `admin123`

## API Endpoints

### Login
- **POST** `/api/login`
- Body: `{ "username": "admin", "password": "admin123" }`
- Returns: `{ "success": true, "message": "Login successful" }`

### Logout
- **POST** `/api/logout`
- Returns: `{ "success": true, "message": "Logged out" }`

### Check Auth Status
- **GET** `/api/auth/check`
- Returns: `{ "authenticated": true, "username": "admin" }`

### Protected Endpoints
- **POST** `/api/ussd/simulator` - Requires authentication in production
- Frontend simulator page - Shows login form if not authenticated

## Security Notes

1. **Change default credentials** before deploying to production
2. **Use strong passwords** for admin account
3. **Set secure session secret** - use a long random string
4. **Enable HTTPS** in production for secure cookie transmission
5. **Session expires** after 10 minutes of inactivity

## Frontend Protection

The simulator page (`/`) is wrapped with `LoginGate` component:
- Checks authentication status on load
- Shows login form if not authenticated (production only)
- Allows access without login in development

## PHP Backend

The PHP backend (`api/ussd_simulator.php`) also checks authentication:
- Uses PHP sessions (`$_SESSION`)
- Same environment variable configuration
- Same behavior: open in development, protected in production

## Testing

### Development
```bash
# No login needed - just access the simulator
npm run dev
# Open http://localhost:5000
```

### Production
```bash
# Set environment variables
export APP_ENV=production
export ADMIN_USERNAME=your_admin
export ADMIN_PASSWORD=your_secure_password

# Access requires login
# 1. Visit simulator page
# 2. Enter credentials
# 3. Access granted
```

## Upgrading Security (Future)

For enhanced security, consider:
- Database-backed user management
- Password hashing (bcrypt/argon2)
- JWT tokens instead of sessions
- Two-factor authentication (2FA)
- Rate limiting on login attempts
- IP whitelisting for admin access

