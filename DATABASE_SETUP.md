# Database Setup Guide

## Overview

This project uses **MariaDB/MySQL** for local development and production.

## Local Development (MariaDB/MySQL)

**Setup:**
```bash
# Install MariaDB locally (if needed)
# macOS: brew install mariadb
# Ubuntu: sudo apt install mariadb-server

# Create database
mysql -u root -p < database/migrations.sql
mysql -u root -p < database/add-payment-fields.sql
mysql -u root -p < database/add-fee-transactions-mysql.sql

# Configure .env
DB_HOST=127.0.0.1
DB_NAME=auction
DB_USER=ussd_user
DB_PASS=your_password
```

## Production Deployment (Contabo VPS)

**Always use MariaDB** - see `DEPLOYMENT.md` for complete setup.

**Configuration:**
- Use `env.example.production` as template
- Set `DB_HOST=127.0.0.1`
- Set `DB_NAME=ussd_jenga` (or your preferred name)
- Use MySQL migrations: `database/migrations.sql` and `database/add-fee-transactions-mysql.sql`

## Migration Files

- `database/migrations.sql` - Base schema (MySQL/MariaDB)
- `database/add-payment-fields.sql` - Payment tracking fields
- `database/add-fee-transactions-mysql.sql` - Fee transactions

## Environment Variables

### Local Development or Production
```env
DB_HOST=127.0.0.1
DB_NAME=auction
DB_USER=ussd_user
DB_PASS=your_secure_password
```

## Summary

| Environment | Database | Config File | Migration Files |
|------------|----------|-------------|----------------|
| Local Dev | MariaDB | `env.example` | `migrations.sql`, `add-fee-transactions-mysql.sql` |
| Production (Contabo) | MariaDB | `env.example.production` | `migrations.sql`, `add-fee-transactions-mysql.sql` |

