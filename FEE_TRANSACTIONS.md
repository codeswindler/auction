# Fee Transaction System

## Overview

The system now records fees as separate transactions when they are successfully paid via M-Pesa STK Push. This allows you to track fee payments separately from the main transaction amounts.

## How It Works

### 1. Transaction Creation

When a user requests a loan or withdrawal:

**Loan Example:**
- Main Transaction: Loan amount (KES 25,100) - `type: 'loan'`
- Fee Transaction: Loan fee (KES 200) - `type: 'loan_fee'`, `isFee: true`, linked via `parent_transaction_id`

**Withdrawal Example:**
- Main Transaction: Withdrawal amount (KES 10,000) - `type: 'withdrawal'`
- Fee Transaction: Withdrawal fee (KES 135) - `type: 'withdrawal_fee'`, `isFee: true`, linked via `parent_transaction_id`

### 2. M-Pesa Payment Flow

When M-Pesa STK Push payment is received:

1. **Payment callback** arrives at `/api/mpesa/callback`
2. System finds the transaction by phone number and amount
3. Updates the transaction (main or fee) with payment details:
   - M-Pesa receipt number
   - Payment status: `paid`
   - Payment method: `mpesa`
   - Payment date
4. If fee is paid, checks if parent transaction fees are all paid
5. If all fees paid, updates parent transaction status

### 3. Admin Dashboard Display

- Fee transactions are shown with `[FEE]` label
- Fee transactions have light blue background
- Can filter to show only fees or exclude fees
- Shows relationship between main transaction and its fees

## Database Schema

### New Fields

- `parent_transaction_id` - Links fee transactions to main transaction
- `is_fee` - Boolean flag indicating if transaction is a fee
- Payment tracking fields (from previous migration):
  - `payment_method`
  - `mpesa_receipt`
  - `payment_status`
  - `payment_date`

## Migration

Run the migration to add fee support:

```bash
# MySQL/MariaDB
mysql -u user -p database_name < database/add-fee-transactions-mysql.sql
```

## Transaction Types

- `loan` - Main loan transaction
- `loan_fee` - Loan processing fee
- `withdrawal` - Main withdrawal transaction
- `withdrawal_fee` - Withdrawal processing fee
- `deposit` - Deposit transaction
- `fee` - Generic fee (for future use)

## API Usage

### Create Fee Transaction

```php
$feeTransactionId = $storage->createFeeTransaction(
    $userId,
    $feeAmount,
    $feeReference,
    $parentTransactionId,
    'loan_fee' // or 'withdrawal_fee'
);
```

### Get Fee Transactions

```php
$fees = $storage->getFeeTransactions($parentTransactionId);
```

## Admin Dashboard Filters

You can filter transactions to:
- Show only fees: Filter by type `loan_fee` or `withdrawal_fee`
- Hide fees: Use `includeFees=false` parameter (future enhancement)
- Show payment status: Filter by `payment_status=paid` to see successfully paid fees

## Example Transaction Flow

1. User requests loan of KES 25,100
   - Transaction 1: Loan KES 25,100 (pending)
   - Transaction 2: Fee KES 200 (pending, parent: Transaction 1)

2. User pays fee via M-Pesa STK Push
   - Transaction 2 updated: Fee KES 200 (paid, M-Pesa Receipt: RFT123456)

3. User pays loan amount via M-Pesa STK Push
   - Transaction 1 updated: Loan KES 25,100 (paid, M-Pesa Receipt: RFT123457)
   - Transaction 1 status: completed (all fees paid)

## Benefits

- ✅ Separate tracking of fees vs. principal amounts
- ✅ Clear visibility of which fees have been paid
- ✅ Better financial reporting
- ✅ Ability to track fee collection separately
- ✅ Link fees to their parent transactions

