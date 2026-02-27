<?php
/**
 * M-Pesa C2B (Customer to Business) Payment Callback Endpoint
 * This endpoint receives C2B payment confirmations from M-Pesa
 * C2B is when customers send money directly to paybill/till number
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Storage.php';
require_once __DIR__ . '/onfon-sms.service.php';

$storage = new Storage($pdo);
$onfonSms = new OnfonSmsService();

// Security: Log all incoming requests
$clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
error_log("[MPESA C2B CALLBACK] IP: {$clientIp}, User-Agent: {$userAgent}");

// Get JSON body from M-Pesa callback
$json = file_get_contents('php://input');
$data = json_decode($json, true);

// Log the callback for debugging
error_log("M-Pesa C2B Callback from IP {$clientIp}: " . json_encode($data));

try {
    // M-Pesa C2B callback structure
    // Format: {
    //   "TransactionType": "Pay Bill",
    //   "TransID": "...",
    //   "TransTime": "20240101120000",
    //   "TransAmount": "100.00",
    //   "BusinessShortCode": "...",
    //   "BillRefNumber": "...", // This is your AccountReference
    //   "InvoiceNumber": "...",
    //   "OrgAccountBalance": "...",
    //   "ThirdPartyTransID": "...",
    //   "MSISDN": "254700000000",
    //   "FirstName": "...",
    //   "MiddleName": "...",
    //   "LastName": "..."
    // }
    
    $transactionType = $data['TransactionType'] ?? null;
    $transId = $data['TransID'] ?? $data['TransId'] ?? null;
    $transTime = $data['TransTime'] ?? null;
    $transAmount = $data['TransAmount'] ?? $data['TransAmount'] ?? null;
    $businessShortCode = $data['BusinessShortCode'] ?? null;
    $billRefNumber = $data['BillRefNumber'] ?? $data['BillRefNumber'] ?? null; // This is the AccountReference
    $invoiceNumber = $data['InvoiceNumber'] ?? null;
    $msisdn = $data['MSISDN'] ?? $data['Msisdn'] ?? null;
    $firstName = $data['FirstName'] ?? '';
    $middleName = $data['MiddleName'] ?? '';
    $lastName = $data['LastName'] ?? '';
    
    // Normalize phone number
    $phoneNumber = preg_replace('/[^0-9]/', '', $msisdn);
    if (substr($phoneNumber, 0, 1) === '0') {
        $phoneNumber = '254' . substr($phoneNumber, 1);
    }
    
    // Convert amount to float
    $amount = floatval($transAmount);
    
    // Convert transaction time to datetime
    $paymentDate = null;
    if ($transTime) {
        // M-Pesa format: YYYYMMDDHHmmss
        if (strlen($transTime) === 14) {
            $year = substr($transTime, 0, 4);
            $month = substr($transTime, 4, 2);
            $day = substr($transTime, 6, 2);
            $hour = substr($transTime, 8, 2);
            $minute = substr($transTime, 10, 2);
            $second = substr($transTime, 12, 2);
            $paymentDate = "{$year}-{$month}-{$day} {$hour}:{$minute}:{$second}";
        }
    }
    if (!$paymentDate) {
        $paymentDate = date('Y-m-d H:i:s');
    }
    
    // Build customer name
    $customerName = trim("{$firstName} {$middleName} {$lastName}");
    if (empty($customerName)) {
        $customerName = null;
    }
    
    if (!$transId || !$amount || !$phoneNumber) {
        error_log("M-Pesa C2B Callback Error: Missing required fields - TransID: " . ($transId ?: 'empty') . ", Amount: " . ($amount ?: 'empty') . ", Phone: " . ($phoneNumber ?: 'empty'));
        jsonResponse(['ResultCode' => 1, 'ResultDesc' => 'Missing required fields'], 400);
    }
    
    // Find transaction by BillRefNumber (AccountReference) or phone+amount
    $transaction = null;
    
    if ($billRefNumber) {
        // Try to find by reference (BillRefNumber is the AccountReference you set when customer sent money)
        $stmt = $pdo->prepare("
            SELECT * FROM transactions 
            WHERE reference = ? 
            AND payment_status = 'pending'
            ORDER BY created_at DESC
            LIMIT 1
        ");
        $stmt->execute([$billRefNumber]);
        $transaction = $stmt->fetch();
    }
    
    // If not found, try by phone number and amount
    if (!$transaction && $phoneNumber && $amount) {
        $user = $storage->getUserByPhoneNumber($phoneNumber);
        if ($user) {
            // Find pending transaction for this user and amount
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
        // Update transaction with payment details
        $paymentData = [
            'payment_method' => 'mpesa_c2b',
            'mpesa_receipt' => $transId,
            'mpesa_transaction_id' => $transId,
            'payment_phone' => $phoneNumber,
            'payment_status' => 'paid',
            'payment_date' => $paymentDate,
        ];
        
        if ($customerName) {
            $paymentData['payment_name'] = $customerName;
        }
        
        $storage->updateTransactionPayment($transaction['id'], $paymentData);
        
        // Update transaction status to completed
        $stmt = $pdo->prepare("UPDATE transactions SET status = 'completed' WHERE id = ?");
        $stmt->execute([$transaction['id']]);
        
        // Update user balance for deposits
        if ($transaction['type'] === 'deposit') {
            $user = $storage->getUserById($transaction['user_id']);
            if ($user) {
                $currentBalance = floatval($user['balance']);
                $depositAmount = floatval($transaction['amount']);
                $newBalance = $currentBalance + $depositAmount;
                $storage->updateUserBalance($transaction['user_id'], number_format($newBalance, 2, '.', ''));
                error_log("C2B Deposit balance updated: User ID {$transaction['user_id']}, Amount: {$depositAmount}, New Balance: {$newBalance}");
            }
        }
        
        error_log("M-Pesa C2B payment recorded: Transaction ID {$transaction['id']}, M-Pesa TransID: {$transId}, Amount: {$amount}, Phone: {$phoneNumber}");
        
        // Send Onfon autoresponse SMS for successful C2B payment
        $reference = $transaction['reference'] ?? 'N/A';
        
        // Customize message based on transaction type - keep bidders engaged (GSM-7 compatible, no emojis)
        if ($transaction['is_fee'] == 1 || $transaction['type'] === 'bid_fee') {
            // Bid fee payment - create urgency and excitement
            $messages = [
                "Bid fee Ksh {$amount} received! Ref: {$reference}\nYour bid is LIVE! Others are bidding too...\nStay sharp! Dial *855*22#",
                "Bid fee confirmed! Ksh {$amount} | Ref: {$reference}\nYou're in the game! Competition is heating up.\nDial *855*22# to stay ahead!",
                "Bid active! Ksh {$amount} | Ref: {$reference}\nThe action is intense! Don't miss out.\nDial *855*22# now!",
                "Bid fee received! Ksh {$amount} | Ref: {$reference}\nYou're competing! Others are watching.\nDial *855*22# to keep bidding!",
                "Bid confirmed! Ksh {$amount} | Ref: {$reference}\nYou're in the race! Every bid counts.\nDial *855*22# to continue!"
            ];
            $smsMessage = $messages[array_rand($messages)];
        } elseif ($transaction['type'] === 'bid') {
            // Main bid payment
            $messages = [
                "Bid {$reference} of Ksh {$amount} placed!\nThe competition is fierce! Keep bidding.\nDial *855*22#",
                "Your bid {$reference} (Ksh {$amount}) is active!\nOthers are bidding too. Stay competitive!\nDial *855*22#",
                "Bid {$reference} confirmed! Ksh {$amount}\nYou're in the game! Don't stop now.\nDial *855*22# to bid again!"
            ];
            $smsMessage = $messages[array_rand($messages)];
        } else {
            // Other payments
            $smsMessage = "Payment of Ksh {$amount} received! Ref: {$reference}\nThank you for using LiveAuction!\nDial *855*22#";
        }
        
        $smsResult = $onfonSms->send($phoneNumber, $smsMessage);
        if ($smsResult['status'] === 'success') {
            error_log("Onfon autoresponse SMS sent successfully to {$phoneNumber} for C2B payment");
        } else {
            error_log("Onfon autoresponse SMS failed: " . ($smsResult['message'] ?? 'Unknown error'));
        }
        
    } else {
        error_log("M-Pesa C2B callback received but transaction not found: Phone: {$phoneNumber}, Amount: {$amount}, BillRefNumber: {$billRefNumber}");
        
        // Still send autoresponse SMS even if transaction not found
        $smsMessage = "Payment of Ksh {$amount} received. Thank you!";
        $onfonSms->send($phoneNumber, $smsMessage);
    }
    
    // Return success response to M-Pesa (required for C2B)
    jsonResponse([
        'ResultCode' => 0,
        'ResultDesc' => 'C2B payment processed successfully'
    ]);
    
} catch (Exception $e) {
    error_log("M-Pesa C2B Callback Error: " . $e->getMessage());
    jsonResponse(['ResultCode' => 1, 'ResultDesc' => 'Processing error'], 500);
}
