# M-Pesa STK Push Integration Guide

## Overview

This guide explains how to integrate M-Pesa STK Push payments and track them in the admin dashboard.

## Database Migration

First, run the migration to add payment tracking fields:

```bash
# MySQL/MariaDB
mysql -u user -p database_name < database/add-payment-fields.sql
```

This adds the following fields to the `transactions` table:
- `payment_method` - Method used (mpesa, bank, cash)
- `mpesa_receipt` - M-Pesa receipt number
- `mpesa_transaction_id` - M-Pesa transaction ID
- `payment_phone` - Phone number used for payment
- `payment_date` - When payment was received
- `payment_status` - Payment status (pending, paid, failed, cancelled)

## M-Pesa Callback Endpoint

The system includes a callback endpoint at `/api/mpesa/callback` that receives payment confirmations from M-Pesa.

### Endpoint Details

- **URL**: `https://jengacapital.co.ke/api/mpesa/callback`
- **Method**: POST
- **Content-Type**: application/json

### Callback Structure

The endpoint expects M-Pesa STK Push callback in this format:

```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "...",
      "CheckoutRequestID": "...",
      "ResultCode": 0,
      "ResultDesc": "Success",
      "CallbackMetadata": {
        "Item": [
          {
            "Name": "Amount",
            "Value": 100.00
          },
          {
            "Name": "MpesaReceiptNumber",
            "Value": "RFT123456789"
          },
          {
            "Name": "TransactionDate",
            "Value": "20240101120000"
          },
          {
            "Name": "PhoneNumber",
            "Value": "254700000000"
          }
        ]
      }
    }
  }
}
```

### Configuration

When setting up M-Pesa STK Push:

1. **Callback URL**: Provide `https://jengacapital.co.ke/api/mpesa/callback` to M-Pesa
2. **Validation URL**: Optional, can use same endpoint or create separate validation endpoint
3. **Store Request IDs**: When initiating STK Push, store `MerchantRequestID` or `CheckoutRequestID` in your transaction reference or a separate field

## How It Works

1. **User initiates transaction** (loan, withdrawal, deposit)
   - Transaction created with `status: 'pending'` and `payment_status: 'pending'`

2. **STK Push sent** to user's phone
   - User enters PIN
   - M-Pesa processes payment

3. **M-Pesa sends callback** to `/api/mpesa/callback`
   - System finds transaction by phone number and amount
   - Updates transaction with payment details
   - Sets `payment_status: 'paid'` and `status: 'completed'`

4. **Admin dashboard shows** payment details
   - M-Pesa receipt number
   - Payment method
   - Payment status
   - Payment date

## Admin Dashboard Filters

The admin dashboard now supports filtering transactions by:

- **Type**: Loan, Withdrawal, Deposit
- **Status**: Pending, Completed
- **Payment Status**: Pending Payment, Paid, Failed
- **Payment Method**: M-Pesa, Bank, Cash
- **Date Range**: From date, To date

## API Endpoints

### Get Filtered Transactions

```
GET /api/admin/transactions?type=loan&payment_status=paid&date_from=2024-01-01&date_to=2024-01-31
```

**Query Parameters:**
- `type` - Filter by transaction type (loan, withdrawal, deposit)
- `status` - Filter by status (pending, completed)
- `payment_status` - Filter by payment status (pending, paid, failed)
- `payment_method` - Filter by payment method (mpesa, bank, cash)
- `date_from` - Filter from date (YYYY-MM-DD)
- `date_to` - Filter to date (YYYY-MM-DD)
- `limit` - Limit number of results

## Testing

### Test M-Pesa Callback

You can test the callback endpoint manually:

```bash
curl -X POST https://jengacapital.co.ke/api/mpesa/callback \
  -H "Content-Type: application/json" \
  -d '{
    "Body": {
      "stkCallback": {
        "MerchantRequestID": "test123",
        "CheckoutRequestID": "test456",
        "ResultCode": 0,
        "ResultDesc": "Success",
        "CallbackMetadata": {
          "Item": [
            {"Name": "Amount", "Value": 1000},
            {"Name": "MpesaReceiptNumber", "Value": "RFT123456789"},
            {"Name": "TransactionDate", "Value": "20240101120000"},
            {"Name": "PhoneNumber", "Value": "254700000000"}
          ]
        }
      }
    }
  }'
```

## Next Steps

1. **Integrate M-Pesa STK Push API** in your application
2. **Store MerchantRequestID** when initiating STK Push (link it to transaction)
3. **Configure callback URL** in M-Pesa dashboard
4. **Test with sandbox** before going live
5. **Monitor callbacks** in server logs

## Notes

- The callback endpoint matches transactions by phone number and amount
- For better matching, consider storing `MerchantRequestID` in transaction reference
- Payment status is separate from transaction status
- Failed payments are logged but don't update transaction status

