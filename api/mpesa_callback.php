<?php
/**
 * M-Pesa STK Push Callback Endpoint
 * This endpoint receives payment confirmations from M-Pesa
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Storage.php';

$storage = new Storage($pdo);

// Security: Log all incoming requests to identify sources
$clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
$requestHeaders = getallheaders();
error_log("[CALLBACK SECURITY] IP: {$clientIp}, User-Agent: {$userAgent}, Headers: " . json_encode($requestHeaders));

// Optional: IP whitelist for M-Pesa callbacks (uncomment and add M-Pesa IPs if known)
// M-Pesa typically uses specific IP ranges - you may need to contact Safaricom for exact IPs
// $allowedIps = ['196.201.214.200', '196.201.214.206', '196.201.213.114', '196.201.214.207', '196.201.214.208'];
// if (!in_array($clientIp, $allowedIps)) {
//     error_log("[CALLBACK SECURITY] Blocked request from unauthorized IP: {$clientIp}");
//     jsonResponse(['ResultCode' => 1, 'ResultDesc' => 'Unauthorized'], 403);
// }

// Get JSON body from M-Pesa callback
$json = file_get_contents('php://input');
$data = json_decode($json, true);

// Log the callback for debugging
error_log("M-Pesa Callback from IP {$clientIp}: " . json_encode($data));

try {
    // M-Pesa STK Push callback structure (adjust based on your M-Pesa API provider)
    // This is a generic structure - adjust fields based on your M-Pesa API documentation
    
    $body = $data['Body'] ?? $data;
    $stkCallback = $body['stkCallback'] ?? null;
    
    if (!$stkCallback) {
        jsonResponse(['ResultCode' => 1, 'ResultDesc' => 'Invalid callback data'], 400);
    }
    
    $resultCode = $stkCallback['ResultCode'] ?? null;
    $resultDesc = $stkCallback['ResultDesc'] ?? 'Unknown';
    $merchantRequestID = $stkCallback['MerchantRequestID'] ?? null;
    $checkoutRequestID = $stkCallback['CheckoutRequestID'] ?? null;
    
    // Find transaction by reference (you'll need to store MerchantRequestID or CheckoutRequestID when initiating STK)
    // For now, we'll use the reference from callback metadata
    $callbackMetadata = $stkCallback['CallbackMetadata'] ?? null;
    $items = $callbackMetadata['Item'] ?? [];
    
    $mpesaReceipt = null;
    $mpesaTransactionId = null;
    $phoneNumber = null;
    $amount = null;
    $reference = null;
    $paymentDate = null; // Initialize to null
    $customerName = null; // Initialize customer name
    
    foreach ($items as $item) {
        $name = $item['Name'] ?? '';
        $value = $item['Value'] ?? '';
        
        switch ($name) {
            case 'MpesaReceiptNumber':
                $mpesaReceipt = $value;
                break;
            case 'TransactionDate':
                // Convert M-Pesa date format to timestamp
                // Validate strtotime() result to prevent PHP 8.0+ errors
                $timestamp = strtotime($value);
                if ($timestamp !== false) {
                    $paymentDate = date('Y-m-d H:i:s', $timestamp);
                }
                break;
            case 'PhoneNumber':
                $phoneNumber = $value;
                break;
            case 'Amount':
                $amount = $value;
                break;
            case 'FirstName':
                // M-Pesa provides first name
                $customerName = $value;
                break;
            case 'LastName':
                // M-Pesa provides last name - append to first name if exists
                if ($customerName) {
                    $customerName .= ' ' . $value;
                } else {
                    $customerName = $value;
                }
                break;
            case 'Name':
                // Some M-Pesa implementations provide full name directly
                if (!$customerName) {
                    $customerName = $value;
                }
                break;
        }
    }
    
    // If successful payment (ResultCode 0)
    if ($resultCode == 0) {
        $transaction = null;
        
        // First, try to find transaction by CheckoutRequestID (M-Pesa uses this in callbacks)
        if ($checkoutRequestID) {
            $stmt = $pdo->prepare("
                SELECT * FROM transactions 
                WHERE mpesa_transaction_id = ? 
                AND payment_status = 'pending'
                LIMIT 1
            ");
            $stmt->execute([$checkoutRequestID]);
            $transaction = $stmt->fetch();
        }
        
        // If not found, try by MerchantRequestID (our generated ID)
        if (!$transaction && $merchantRequestID) {
            $stmt = $pdo->prepare("
                SELECT * FROM transactions 
                WHERE merchant_request_id = ? 
                AND payment_status = 'pending'
                LIMIT 1
            ");
            $stmt->execute([$merchantRequestID]);
            $transaction = $stmt->fetch();
            
            // Also try mpesa_transaction_id with MerchantRequestID
            if (!$transaction) {
                $stmt = $pdo->prepare("
                    SELECT * FROM transactions 
                    WHERE mpesa_transaction_id = ? 
                    AND payment_status = 'pending'
                    LIMIT 1
                ");
                $stmt->execute([$merchantRequestID]);
                $transaction = $stmt->fetch();
            }
        }
        
        // Fallback: Find by phone number and amount (for backward compatibility)
        if (!$transaction && $phoneNumber && $amount) {
            // Get user by phone
            $user = $storage->getUserByPhoneNumber($phoneNumber);
            
            if ($user) {
                // Find pending transaction for this user and amount (could be main transaction or fee)
                // Prioritize fee transactions first, then main transactions
                $stmt = $pdo->prepare("
                    SELECT * FROM transactions 
                    WHERE user_id = ? 
                    AND ABS(CAST(amount AS DECIMAL) - ?) < 0.01
                    AND payment_status = 'pending'
                    ORDER BY is_fee DESC, created_at DESC 
                    LIMIT 1
                ");
                $stmt->execute([$user['id'], $amount]);
                $transaction = $stmt->fetch();
            }
        }
                
                if ($transaction) {
                    // Update transaction with payment details
            $paymentData = [
                        'payment_method' => 'mpesa',
                        'mpesa_receipt' => $mpesaReceipt,
                'mpesa_transaction_id' => $checkoutRequestID ?: $merchantRequestID,
                        'payment_phone' => $phoneNumber,
                        'payment_status' => 'paid',
                        'payment_date' => $paymentDate ?? date('Y-m-d H:i:s'),
            ];
            
            // Add customer name if available from M-Pesa callback
            if ($customerName) {
                $paymentData['payment_name'] = $customerName;
            }
            
            $storage->updateTransactionPayment($transaction['id'], $paymentData);
                    
                    // Update transaction status to completed
                    $stmt = $pdo->prepare("UPDATE transactions SET status = 'completed' WHERE id = ?");
                    $stmt->execute([$transaction['id']]);
                    
            // Handle fee transaction status updates
                    if ($transaction['is_fee'] && $transaction['parent_transaction_id']) {
                // This is a fee transaction - check if all fees for parent are now paid
                        $feeTransactions = $storage->getFeeTransactions($transaction['parent_transaction_id']);
                        $allFeesPaid = true;
                
                        foreach ($feeTransactions as $feeTx) {
                    // Check if fee is paid (handle both 'paid' string and numeric 1 for MySQL)
                    $feePaymentStatus = $feeTx['payment_status'] ?? null;
                    if ($feePaymentStatus !== 'paid' && $feePaymentStatus !== '1') {
                                $allFeesPaid = false;
                                break;
                            }
                        }
                        
                error_log("Fee payment: Transaction ID {$transaction['id']}, Parent ID: {$transaction['parent_transaction_id']}, All fees paid: " . ($allFeesPaid ? 'Yes' : 'No'));
                
                // If all fees are paid and parent transaction is also paid, mark parent as completed
                        if ($allFeesPaid) {
                            $parentTx = $storage->getTransactionById($transaction['parent_transaction_id']);
                    if ($parentTx) {
                        $parentPaymentStatus = $parentTx['payment_status'] ?? null;
                        if ($parentPaymentStatus === 'paid' || $parentPaymentStatus === '1') {
                                $stmt = $pdo->prepare("UPDATE transactions SET status = 'completed' WHERE id = ?");
                                $stmt->execute([$parentTx['id']]);
                            error_log("Parent transaction {$parentTx['id']} marked as completed (all fees paid)");
                        }
                    }
                }
            } else if (!$transaction['is_fee']) {
                // This is a main transaction - check if it has fees that need to be paid
                $feeTransactions = $storage->getFeeTransactions($transaction['id']);
                if (count($feeTransactions) > 0) {
                    error_log("Main transaction {$transaction['id']} has " . count($feeTransactions) . " fee transaction(s)");
                    // Fee transactions are tracked separately and will be paid via separate STK pushes
                }
                
                // Update user balance for deposits
                if ($transaction['type'] === 'deposit') {
                    $user = $storage->getUserById($transaction['user_id']);
                    if ($user) {
                        $currentBalance = floatval($user['balance']);
                        $depositAmount = floatval($transaction['amount']);
                        $newBalance = $currentBalance + $depositAmount;
                        $storage->updateUserBalance($transaction['user_id'], number_format($newBalance, 2, '.', ''));
                        error_log("Deposit balance updated: User ID {$transaction['user_id']}, Amount: {$depositAmount}, New Balance: {$newBalance}");
                    }
                }
                    }
                    
            error_log("Payment recorded: Transaction ID {$transaction['id']}, Type: " . ($transaction['is_fee'] ? 'Fee' : 'Main') . ", M-Pesa Receipt: {$mpesaReceipt}, Amount: {$amount}");
        } else {
            error_log("Transaction not found for payment: Phone: {$phoneNumber}, Amount: {$amount}, MerchantRequestID: {$merchantRequestID}");
        }
        
        jsonResponse(['ResultCode' => 0, 'ResultDesc' => 'Success']);
    } else {
        // Payment failed - update transaction status
        error_log("Payment failed: ResultCode {$resultCode}, Description: {$resultDesc}, MerchantRequestID: {$merchantRequestID}");
        
        // Try to find transaction by MerchantRequestID or CheckoutRequestID to mark it as failed
        $transaction = null;
        
        // Try by MerchantRequestID first
        if ($merchantRequestID) {
            // Try by merchant_request_id field (exact match)
            $stmt = $pdo->prepare("
                SELECT * FROM transactions 
                WHERE merchant_request_id = ? 
                AND payment_status = 'pending'
                LIMIT 1
            ");
            $stmt->execute([$merchantRequestID]);
            $transaction = $stmt->fetch();
            
            // If not found, try by mpesa_transaction_id (which also stores MerchantRequestID)
            if (!$transaction) {
                $stmt = $pdo->prepare("
                    SELECT * FROM transactions 
                    WHERE mpesa_transaction_id = ? 
                    AND payment_status = 'pending'
                    LIMIT 1
                ");
                $stmt->execute([$merchantRequestID]);
                $transaction = $stmt->fetch();
            }
            
            // If still not found, try partial match (M-Pesa might transform our ID)
            if (!$transaction) {
                // Extract potential transaction ID from our format: JENGA-{timestamp}-{transactionId}
                // Or try to match by last part of MerchantRequestID
                $stmt = $pdo->prepare("
                    SELECT * FROM transactions 
                    WHERE (merchant_request_id LIKE ? OR mpesa_transaction_id LIKE ?)
                    AND payment_status = 'pending'
                    ORDER BY created_at DESC
                    LIMIT 1
                ");
                $searchPattern = '%' . substr($merchantRequestID, -10) . '%'; // Last 10 chars
                $stmt->execute([$searchPattern, $searchPattern]);
                $transaction = $stmt->fetch();
            }
        }
        
        // Try by CheckoutRequestID if MerchantRequestID didn't work
        if (!$transaction && $checkoutRequestID) {
            $stmt = $pdo->prepare("
                SELECT * FROM transactions 
                WHERE mpesa_transaction_id = ? 
                AND payment_status = 'pending'
                LIMIT 1
            ");
            $stmt->execute([$checkoutRequestID]);
            $transaction = $stmt->fetch();
        }
        
        // Final fallback: Try to find by phone number and amount (for failed payments without metadata)
        // This won't work for failed payments since they don't have CallbackMetadata, but worth trying
        if (!$transaction && $phoneNumber && $amount) {
            $user = $storage->getUserByPhoneNumber($phoneNumber);
            if ($user) {
                // Find most recent pending transaction for this user with matching amount
                $stmt = $pdo->prepare("
                    SELECT * FROM transactions 
                    WHERE user_id = ? 
                    AND ABS(CAST(amount AS DECIMAL) - ?) < 0.01
                    AND payment_status = 'pending'
                    ORDER BY created_at DESC 
                    LIMIT 1
                ");
                $stmt->execute([$user['id'], $amount]);
                $transaction = $stmt->fetch();
            }
        }
        
        if ($transaction) {
            // Update transaction payment status to failed
            $storage->updateTransactionPayment($transaction['id'], [
                'payment_status' => 'failed',
                'mpesa_transaction_id' => $merchantRequestID ?: $checkoutRequestID, // Store for reference
            ]);
            // Reflect failure in transaction status for reporting
            $stmt = $pdo->prepare("UPDATE transactions SET status = 'failed' WHERE id = ?");
            $stmt->execute([$transaction['id']]);
            
            error_log("Transaction {$transaction['id']} marked as failed: {$resultDesc} (ResultCode: {$resultCode}, MerchantRequestID: {$merchantRequestID})");
            
        } else {
            error_log("Failed payment callback received but transaction not found: MerchantRequestID: {$merchantRequestID}, CheckoutRequestID: {$checkoutRequestID}");
            
            // For failed payments, M-Pesa doesn't send CallbackMetadata, so we can't match by phone+amount
            // But we can try to find by matching the last part of CheckoutRequestID or MerchantRequestID
            // M-Pesa CheckoutRequestID format: ws_CO_05012026140057469727839315
            // Our old format: CHECKOUT-1767609862-34
            // Try to extract transaction ID from our old format if CheckoutRequestID matches pattern
            if ($checkoutRequestID && preg_match('/CHECKOUT-(\d+)-(\d+)/', $checkoutRequestID, $matches)) {
                // Old format: CHECKOUT-timestamp-transactionId
                $possibleTransactionId = $matches[2];
                $stmt = $pdo->prepare("SELECT * FROM transactions WHERE id = ? AND payment_status = 'pending' LIMIT 1");
                $stmt->execute([$possibleTransactionId]);
                $transaction = $stmt->fetch();
                
                if ($transaction) {
                    error_log("Found transaction by extracted ID from old CheckoutRequestID format: Transaction ID {$transaction['id']}");
                }
            }
            
            // If still not found, log recent pending transactions for debugging
            if (!$transaction) {
                $stmt = $pdo->query("SELECT id, merchant_request_id, mpesa_transaction_id, reference, type, amount, payment_status, created_at FROM transactions WHERE payment_status = 'pending' ORDER BY created_at DESC LIMIT 5");
                $pendingTxs = $stmt->fetchAll();
                error_log("Recent pending transactions: " . json_encode($pendingTxs));
            } else {
                // Update the found transaction
                $storage->updateTransactionPayment($transaction['id'], [
                    'payment_status' => 'failed',
                    'mpesa_transaction_id' => $merchantRequestID ?: $checkoutRequestID,
                ]);
                $stmt = $pdo->prepare("UPDATE transactions SET status = 'failed' WHERE id = ?");
                $stmt->execute([$transaction['id']]);
                error_log("Transaction {$transaction['id']} marked as failed: {$resultDesc} (ResultCode: {$resultCode})");
                
                // If user cancelled the STK push (ResultCode 1032), send USSD Push notification
                if ($resultCode == 1032) {
                    // Get user phone number to send notification
                    $user = $storage->getUserById($transaction['user_id']);
                    if ($user && isset($user['phone_number'])) {
                        $phoneNumber = $user['phone_number'];
                        $ussdCode = '*519*65#';
                        $message = "Please note you need to complete the transaction to proceed. Dial {$ussdCode} to try again.";
                        
                        error_log("[NOTIFICATION] STK Push cancelled by user. Sending USSD Push notification to {$phoneNumber}: {$message}");
                        
                        // Send USSD Push notification (popup on user's phone)
                        // This will appear as a popup similar to USSD sessions
                        sendUSSDPushNotification($phoneNumber, $message);
                    }
                }
            }
        }
        
        jsonResponse(['ResultCode' => $resultCode, 'ResultDesc' => $resultDesc]);
    }
    
} catch (Exception $e) {
    error_log("M-Pesa Callback Error: " . $e->getMessage());
    jsonResponse(['ResultCode' => 1, 'ResultDesc' => 'Processing error'], 500);
}

