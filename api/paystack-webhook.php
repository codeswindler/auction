<?php
/**
 * Paystack Webhook – verify signature, handle charge.success / charge.failed
 * Same payment-completion flow as mpesa_callback.php (update transaction, send SMS)
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Storage.php';
require_once __DIR__ . '/onfon-sms.service.php';

$storage = new Storage($pdo);
$onfonSms = new OnfonSmsService();

// Read raw body for signature verification
$rawInput = file_get_contents('php://input');
if ($rawInput === false || $rawInput === '') {
    error_log("[PAYSTACK WEBHOOK] Empty body received");
    jsonResponse(['status' => 'error', 'message' => 'Empty body'], 400);
}

// Verify HMAC-SHA512 signature
$secret = getenv('PAYSTACK_WEBHOOK_SECRET') ?: '';
if ($secret === '') {
    error_log("[PAYSTACK WEBHOOK] PAYSTACK_WEBHOOK_SECRET not set in .env");
    jsonResponse(['status' => 'error', 'message' => 'Webhook not configured'], 500);
}

$signature = $_SERVER['HTTP_X_PAYSTACK_SIGNATURE'] ?? '';
if ($signature === '') {
    error_log("[PAYSTACK WEBHOOK] Missing X-Paystack-Signature header");
    jsonResponse(['status' => 'error', 'message' => 'Missing signature'], 401);
}

$computed = hash_hmac('sha512', $rawInput, $secret);
if (!hash_equals($computed, $signature)) {
    error_log("[PAYSTACK WEBHOOK] Signature mismatch");
    jsonResponse(['status' => 'error', 'message' => 'Invalid signature'], 401);
}

// Parse event
$event = json_decode($rawInput, true);
$eventType = $event['event'] ?? '';

error_log("[PAYSTACK WEBHOOK] Event received: {$eventType}");

// ---- charge.failed ----
if ($eventType === 'charge.failed') {
    $data = $event['data'] ?? [];
    $reference = $data['reference'] ?? null;
    if ($reference) {
        // Find transaction by Paystack reference (stored in mpesa_transaction_id)
        $stmt = $pdo->prepare("
            SELECT * FROM transactions 
            WHERE mpesa_transaction_id = ? 
            AND (payment_status = 'pending' OR payment_status IS NULL)
            LIMIT 1
        ");
        $stmt->execute([$reference]);
        $transaction = $stmt->fetch();

        if ($transaction) {
            $failureMessage = $data['gateway_response'] ?? ($data['message'] ?? 'Payment failed');
            $storage->updateTransactionPayment($transaction['id'], [
                'payment_status'         => 'failed',
                'payment_failure_reason'  => "Paystack: {$failureMessage}",
            ]);
            $stmt = $pdo->prepare("UPDATE transactions SET status = 'failed' WHERE id = ?");
            $stmt->execute([$transaction['id']]);
            error_log("[PAYSTACK WEBHOOK] Transaction {$transaction['id']} marked as failed: {$failureMessage}");

            // Send failure SMS
            $user = $storage->getUserById($transaction['user_id']);
            if ($user && isset($user['phone_number'])) {
                $phoneNumber = $user['phone_number'];
                $amount = $transaction['amount'] ?? '0';
                $txReference = $transaction['reference'] ?? 'N/A';
                $templateType = 'payment_failed';
                $template = $storage->getRandomSmsTemplate($templateType);

                if ($template && !empty($template['template_text'])) {
                    $smsMessage = str_replace(
                        ['{amount}', '{reference}'],
                        [$amount, $txReference],
                        $template['template_text']
                    );
                } else {
                    $smsMessage = "Payment of Ksh {$amount} failed.\nDon't miss out! Dial *855*22# to retry now.";
                }

                $smsResult = $onfonSms->send($phoneNumber, $smsMessage);
                error_log("[PAYSTACK WEBHOOK] Failure SMS result: " . json_encode($smsResult));
            }
        } else {
            error_log("[PAYSTACK WEBHOOK] charge.failed: transaction not found for reference {$reference}");
        }
    }
    jsonResponse(['status' => 'ok']);
}

// ---- Ignore non-success events ----
if ($eventType !== 'charge.success') {
    error_log("[PAYSTACK WEBHOOK] Ignoring event: {$eventType}");
    jsonResponse(['status' => 'ok']);
}

// ---- charge.success ----
$data = $event['data'] ?? [];
$reference = $data['reference'] ?? null;
if (!$reference) {
    error_log("[PAYSTACK WEBHOOK] charge.success without reference");
    jsonResponse(['status' => 'ok']);
}

try {
    // Find transaction by Paystack reference (stored in mpesa_transaction_id)
    $stmt = $pdo->prepare("
        SELECT * FROM transactions 
        WHERE mpesa_transaction_id = ? 
        AND (payment_status = 'pending' OR payment_status IS NULL)
        LIMIT 1
    ");
    $stmt->execute([$reference]);
    $transaction = $stmt->fetch();

    if (!$transaction) {
        error_log("[PAYSTACK WEBHOOK] charge.success: transaction not found for reference {$reference}");
        jsonResponse(['status' => 'ok']);
    }

    // Determine phone number and payment date
    $phoneNumber = $transaction['payment_phone'] ?? null;
    if (!$phoneNumber) {
        $user = $storage->getUserById($transaction['user_id']);
        $phoneNumber = $user['phone_number'] ?? null;
    }
    $paymentDate = date('Y-m-d H:i:s');

    // Update transaction with payment success
    $paymentData = [
        'payment_method'  => 'paystack',
        'mpesa_receipt'   => $reference,  // Use Paystack reference as receipt
        'payment_phone'   => $phoneNumber,
        'payment_status'  => 'paid',
        'payment_date'    => $paymentDate,
    ];

    // Extract customer info from Paystack data if available
    $customerName = $data['customer']['first_name'] ?? null;
    if ($customerName) {
        $lastName = $data['customer']['last_name'] ?? '';
        if ($lastName) $customerName .= ' ' . $lastName;
        $paymentData['payment_name'] = $customerName;
    }

    $updateResult = $storage->updateTransactionPayment($transaction['id'], $paymentData);
    error_log("[PAYSTACK WEBHOOK] Transaction {$transaction['id']} payment update: " . ($updateResult ? 'OK' : 'FAIL'));

    // Mark transaction as completed
    $stmt = $pdo->prepare("UPDATE transactions SET status = 'completed' WHERE id = ?");
    $stmt->execute([$transaction['id']]);

    // Handle fee transaction logic (same as mpesa_callback.php)
    if ($transaction['is_fee'] && $transaction['parent_transaction_id']) {
        $feeTransactions = $storage->getFeeTransactions($transaction['parent_transaction_id']);
        $allFeesPaid = true;
        foreach ($feeTransactions as $feeTx) {
            $feePaymentStatus = $feeTx['payment_status'] ?? null;
            if ($feePaymentStatus !== 'paid' && $feePaymentStatus !== '1') {
                $allFeesPaid = false;
                break;
            }
        }
        if ($allFeesPaid) {
            $parentTx = $storage->getTransactionById($transaction['parent_transaction_id']);
            if ($parentTx) {
                $parentPaymentStatus = $parentTx['payment_status'] ?? null;
                if ($parentPaymentStatus === 'paid' || $parentPaymentStatus === '1') {
                    $stmt = $pdo->prepare("UPDATE transactions SET status = 'completed' WHERE id = ?");
                    $stmt->execute([$parentTx['id']]);
                    error_log("[PAYSTACK WEBHOOK] Parent transaction {$parentTx['id']} marked as completed");
                }
            }
        }
    } else if (!$transaction['is_fee']) {
        // Main transaction – update balance for deposits
        if ($transaction['type'] === 'deposit') {
            $user = $storage->getUserById($transaction['user_id']);
            if ($user) {
                $currentBalance = floatval($user['balance']);
                $depositAmount = floatval($transaction['amount']);
                $newBalance = $currentBalance + $depositAmount;
                $storage->updateUserBalance($transaction['user_id'], number_format($newBalance, 2, '.', ''));
                error_log("[PAYSTACK WEBHOOK] Deposit balance updated: User {$transaction['user_id']}, +{$depositAmount} = {$newBalance}");
            }
        }
    }

    $amount = $transaction['amount'] ?? '0';
    error_log("[PAYSTACK WEBHOOK] Payment recorded: Transaction {$transaction['id']}, Type: " . ($transaction['is_fee'] ? 'Fee' : 'Main') . ", Reference: {$reference}, Amount: {$amount}");

    // Send success SMS (same flow as mpesa_callback.php)
    if ($phoneNumber) {
        $txReference = $transaction['reference'] ?? 'N/A';
        $templateType = 'bid_success';
        $template = $storage->getRandomSmsTemplate($templateType);

        if ($template && !empty($template['template_text'])) {
            $smsMessage = str_replace(
                ['{amount}', '{reference}'],
                [$amount, $txReference],
                $template['template_text']
            );
        } else {
            $smsMessage = "Payment of Ksh {$amount} received! Ref: {$txReference}\nThank you for using LiveAuction!\nDial *855*22#";
        }

        $smsResult = $onfonSms->send($phoneNumber, $smsMessage);
        if ($smsResult['status'] === 'success') {
            error_log("[PAYSTACK WEBHOOK] Success SMS sent to {$phoneNumber}");
        } else {
            error_log("[PAYSTACK WEBHOOK] SMS failed: " . ($smsResult['message'] ?? 'Unknown error'));
        }
    }

} catch (Exception $e) {
    error_log("[PAYSTACK WEBHOOK] Error: " . $e->getMessage());
}

jsonResponse(['status' => 'ok']);
