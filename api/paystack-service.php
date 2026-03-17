<?php
/**
 * Paystack API Service – mobile money / STK-style charge
 * Used when PAYMENT_PROVIDER=paystack
 * 
 * Mirrors the pattern from votingnova, adapted for auction's transaction schema.
 * Reuses the existing `mpesa_transaction_id` column to store the Paystack reference.
 */

/**
 * Initiate a Paystack mobile money charge (STK-style prompt).
 *
 * @param PDO    $pdo           Database connection
 * @param object $storage       Storage instance (for updateTransactionPayment)
 * @param int    $transactionId Auction transaction ID
 * @param string $phone         Phone number (any format – will be normalized)
 * @param float  $amount        Amount in KES
 * @return array ['success' => bool, 'reference' => string|null, 'error' => string|null]
 */
function paystackInitiateCharge($pdo, $storage, $transactionId, $phone, $amount) {
    $secretKey = getenv('PAYSTACK_SECRET_KEY');
    if (empty($secretKey)) {
        error_log("Paystack Error: PAYSTACK_SECRET_KEY not set in .env");
        return ['success' => false, 'reference' => null, 'error' => 'Paystack credentials not configured'];
    }

    // Get transaction details
    $transaction = $storage->getTransactionById($transactionId);
    if (!$transaction) {
        return ['success' => false, 'reference' => null, 'error' => 'Transaction not found'];
    }

    // Normalize phone to +254... format (Paystack Kenya M-Pesa requirement)
    $phone = preg_replace('/[^0-9]/', '', $phone);
    if (substr($phone, 0, 1) === '0') {
        $phone = '254' . substr($phone, 1);
    } elseif (substr($phone, 0, 3) !== '254') {
        $phone = '254' . $phone;
    }
    $phoneForPaystack = '+' . $phone;

    // Validate phone number format
    if (strlen($phone) !== 12) {
        error_log("Paystack Error: Invalid phone number format: {$phone}");
        return ['success' => false, 'reference' => null, 'error' => 'Invalid phone number format'];
    }

    // Amount in subunits (100 subunits = 1 KES)
    $amountSubunits = (int) round($amount * 100);

    // Use the transaction's own reference + timestamp to ensure uniqueness
    $baseRef = preg_replace('/[^a-zA-Z0-9.\-=]/', '', $transaction['reference']);
    $reference = $baseRef . '-' . time();

    $chargeEmail = getenv('PAYSTACK_CHARGE_EMAIL') ?: 'play@jengacapital.co.ke';

    $payload = [
        'email'        => $chargeEmail,
        'amount'       => (string) $amountSubunits,
        'currency'     => 'KES',
        'reference'    => $reference,
        'mobile_money' => [
            'phone'    => $phoneForPaystack,
            'provider' => 'mpesa'
        ]
    ];

    error_log("Paystack Charge payload: " . json_encode($payload));

    $url = 'https://api.paystack.co/charge';
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $secretKey,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        error_log("Paystack Charge cURL error: {$curlError}");
        $storage->updateTransactionPayment($transactionId, [
            'payment_status' => 'failed',
            'payment_failure_reason' => "Paystack connection error: {$curlError}",
        ]);
        $stmt = $pdo->prepare("UPDATE transactions SET status = 'failed' WHERE id = ?");
        $stmt->execute([$transactionId]);
        return ['success' => false, 'reference' => null, 'error' => 'Payment service connection error'];
    }

    if ($httpCode !== 200) {
        $errMsg = "Paystack Charge HTTP {$httpCode}: " . substr($response, 0, 500);
        error_log($errMsg);
        // Also write to STK log so it's visible
        @file_put_contents('/var/log/stk_push.log', date('Y-m-d H:i:s') . " - {$errMsg}\n", FILE_APPEND);
        $storage->updateTransactionPayment($transactionId, [
            'payment_status' => 'failed',
            'payment_failure_reason' => "Paystack HTTP {$httpCode}",
        ]);
        $stmt = $pdo->prepare("UPDATE transactions SET status = 'failed' WHERE id = ?");
        $stmt->execute([$transactionId]);
        return ['success' => false, 'reference' => null, 'error' => 'Payment service returned an error'];
    }

    $data = json_decode($response, true);
    if (!is_array($data)) {
        error_log("Paystack Charge: Invalid JSON response");
        $storage->updateTransactionPayment($transactionId, [
            'payment_status' => 'failed',
            'payment_failure_reason' => 'Invalid Paystack response',
        ]);
        $stmt = $pdo->prepare("UPDATE transactions SET status = 'failed' WHERE id = ?");
        $stmt->execute([$transactionId]);
        return ['success' => false, 'reference' => null, 'error' => 'Invalid payment service response'];
    }

    $ok = $data['status'] ?? false;
    $dataObj = $data['data'] ?? [];
    $ref = is_array($dataObj) ? ($dataObj['reference'] ?? $reference) : $reference;
    $dataStatus = is_array($dataObj) ? ($dataObj['status'] ?? '') : '';

    if (!$ok || $dataStatus === 'failed') {
        $message = $data['message'] ?? 'Charge rejected';
        error_log("Paystack Charge rejected: status=" . ($ok ? 'true' : 'false') . ", data.status={$dataStatus}, message={$message}");
        $storage->updateTransactionPayment($transactionId, [
            'payment_status' => 'failed',
            'payment_failure_reason' => "Paystack: {$message}",
        ]);
        $stmt = $pdo->prepare("UPDATE transactions SET status = 'failed' WHERE id = ?");
        $stmt->execute([$transactionId]);
        return ['success' => false, 'reference' => null, 'error' => $message];
    }

    // Success (or pending/send_otp) — store reference and wait for webhook
    $storage->updateTransactionPayment($transactionId, [
        'mpesa_transaction_id' => $ref,  // Reuse column to store Paystack reference
        'merchant_request_id'  => $ref,
        'payment_method'       => 'paystack',
        'payment_phone'        => $phone,
    ]);

    error_log("Paystack Charge initiated: Transaction ID {$transactionId}, Reference: {$ref}, Paystack status: {$dataStatus}");

    return ['success' => true, 'reference' => $ref, 'error' => null];
}
