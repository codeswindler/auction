# M-Pesa STK Push Integration

## Overview

This document describes the STK Push integration for initiating M-Pesa payments and updating fee transaction statuses.

## Features

1. **STK Push Initiation** - API endpoint to trigger M-Pesa STK push payments
2. **Payment Callback Handling** - Processes M-Pesa payment confirmations
3. **Fee Transaction Status Updates** - Automatically updates fee transaction status when paid
4. **MerchantRequestID Tracking** - Stores MerchantRequestID for accurate callback matching

## API Endpoints

### Initiate STK Push

**Endpoint:** `POST /api/mpesa/stk-push`

**Request Body:**
```json
{
  "transactionId": 123,
  "phoneNumber": "254700000000",
  "amount": 200.00
}
```

**Response:**
```json
{
  "success": true,
  "message": "STK Push initiated successfully",
  "merchantRequestID": "JENGA-1234567890-123",
  "checkoutRequestID": "CHECKOUT-1234567890-123",
  "response": { ... }
}
```

### M-Pesa Callback

**Endpoint:** `POST /api/mpesa/callback`

This endpoint is called by M-Pesa when a payment is completed. It automatically:
- Updates transaction payment status to "paid"
- Records M-Pesa receipt number
- Updates fee transaction status
- Checks if all fees are paid and updates parent transaction status

## Environment Variables

Add these to your `.env` file:

```env
# M-Pesa STK Push Configuration
MPESA_CONSUMER_KEY=your_mpesa_consumer_key
MPESA_CONSUMER_SECRET=your_mpesa_consumer_secret
MPESA_PASSKEY=your_mpesa_passkey
MPESA_SHORTCODE=your_mpesa_shortcode
MPESA_CALLBACK_URL=https://jengacapital.co.ke/api/mpesa/callback

# Optional: Override default M-Pesa API URLs (for sandbox/testing)
# MPESA_ACCESS_TOKEN_URL=https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials
# MPESA_STK_PUSH_URL=https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest
```

## Database Migration

Run the migration to add `merchant_request_id` field:

```bash
# MySQL/MariaDB
mysql -u user -p database_name < database/add-merchant-request-id.sql
```

## How It Works

### 1. Transaction Creation

When a user requests a loan or withdrawal:
- Main transaction is created (e.g., loan amount)
- Fee transaction is created and linked via `parent_transaction_id`

### 2. STK Push Initiation

1. Call `/api/mpesa/stk-push` with transaction details
2. System gets M-Pesa access token
3. Initiates STK push request to M-Pesa
4. Stores `MerchantRequestID` in transaction for callback matching
5. User receives STK push on their phone

### 3. Payment Callback

1. User completes payment on their phone
2. M-Pesa sends callback to `/api/mpesa/callback`
3. System finds transaction by `MerchantRequestID` (or phone + amount as fallback)
4. Updates transaction with payment details:
   - `payment_status` = "paid"
   - `mpesa_receipt` = receipt number
   - `payment_date` = payment timestamp
5. If fee transaction:
   - Checks if all fees for parent transaction are paid
   - Updates parent transaction status if all fees paid
6. If main transaction:
   - Fee transactions are tracked separately

### 4. Fee Transaction Status Updates

The callback automatically handles fee transaction status:

- **Fee Payment**: When a fee transaction is paid:
  - Fee transaction status updated to "paid"
  - System checks all fees for parent transaction
  - If all fees paid AND parent transaction paid, parent status = "completed"

- **Main Transaction Payment**: When main transaction is paid:
  - Main transaction status updated to "paid"
  - Fee transactions remain separate and can be paid independently

## Usage Example

### Initiating STK Push for a Fee Transaction

```javascript
// After creating a loan transaction with fee
const response = await fetch('/api/mpesa/stk-push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    transactionId: feeTransactionId,
    phoneNumber: '254700000000',
    amount: 200.00
  })
});

const result = await response.json();
if (result.success) {
  console.log('STK Push sent! MerchantRequestID:', result.merchantRequestID);
}
```

### Initiating STK Push for Main Transaction

```javascript
// After creating a loan transaction
const response = await fetch('/api/mpesa/stk-push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    transactionId: loanTransactionId,
    phoneNumber: '254700000000',
    amount: 25100.00
  })
});
```

## Testing

### Sandbox Testing

For testing, use M-Pesa sandbox credentials:

```env
MPESA_ACCESS_TOKEN_URL=https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials
MPESA_STK_PUSH_URL=https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest
```

### Manual Callback Testing

You can test the callback endpoint manually:

```bash
curl -X POST https://jengacapital.co.ke/api/mpesa/callback \
  -H "Content-Type: application/json" \
  -d '{
    "Body": {
      "stkCallback": {
        "MerchantRequestID": "JENGA-1234567890-123",
        "CheckoutRequestID": "CHECKOUT-1234567890-123",
        "ResultCode": 0,
        "ResultDesc": "Success",
        "CallbackMetadata": {
          "Item": [
            {"Name": "Amount", "Value": 200},
            {"Name": "MpesaReceiptNumber", "Value": "RFT123456789"},
            {"Name": "TransactionDate", "Value": "20240101120000"},
            {"Name": "PhoneNumber", "Value": "254700000000"}
          ]
        }
      }
    }
  }'
```

## Error Handling

The system handles various error scenarios:

- **Missing Credentials**: Returns 500 error if M-Pesa credentials not configured
- **Transaction Not Found**: Returns 404 if transaction doesn't exist
- **Access Token Failure**: Logs error and returns 500
- **STK Push Failure**: Returns error details from M-Pesa API
- **Callback Matching**: Falls back to phone + amount matching if MerchantRequestID not found

## Security Notes

1. **Never commit `.env` file** with M-Pesa credentials
2. **Use HTTPS** for callback URL in production
3. **Validate callback signatures** (if M-Pesa provides signature validation)
4. **Rate limit** STK push endpoint to prevent abuse
5. **Log all STK push requests** for audit trail

## Next Steps

1. Configure M-Pesa credentials in `.env` file
2. Run database migration for `merchant_request_id` field
3. Test with M-Pesa sandbox
4. Configure callback URL in M-Pesa dashboard
5. Monitor callback logs for successful payments

