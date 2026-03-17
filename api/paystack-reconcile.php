<?php
/**
 * Paystack Transaction Reconciliation Script
 * 
 * Finds all pending Paystack transactions and verifies their status
 * via Paystack's Verify API, then updates the DB accordingly.
 *
 * Usage: php api/paystack-reconcile.php
 * Or via browser: /api/paystack/reconcile (if route is added)
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Storage.php';

header('Content-Type: application/json');

$storage = new Storage($pdo);
$secretKey = getenv('PAYSTACK_SECRET_KEY');

if (empty($secretKey)) {
    echo json_encode(['error' => 'PAYSTACK_SECRET_KEY not set']);
    exit;
}

// Find all pending transactions that went through Paystack
// They have payment_method = 'paystack' OR mpesa_transaction_id matching a Paystack reference
$stmt = $pdo->prepare("
    SELECT id, reference, mpesa_transaction_id, amount, payment_status, status, user_id, type, is_fee, parent_transaction_id
    FROM transactions 
    WHERE (payment_method = 'paystack' OR mpesa_transaction_id IS NOT NULL)
    AND (payment_status = 'pending' OR payment_status IS NULL)
    AND status != 'completed'
    ORDER BY created_at DESC
");
$stmt->execute();
$pending = $stmt->fetchAll();

$results = [];
$updated = 0;
$failed = 0;
$notFound = 0;

foreach ($pending as $tx) {
    // The Paystack reference is stored in mpesa_transaction_id, or it's the transaction reference
    $ref = $tx['mpesa_transaction_id'] ?: $tx['reference'];
    
    if (empty($ref)) {
        $results[] = ['id' => $tx['id'], 'status' => 'skipped', 'reason' => 'no reference'];
        continue;
    }

    // Verify with Paystack API
    $url = "https://api.paystack.co/transaction/verify/" . urlencode($ref);
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $secretKey,
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        $results[] = ['id' => $tx['id'], 'ref' => $ref, 'status' => 'not_found_on_paystack', 'http' => $httpCode];
        $notFound++;
        continue;
    }

    $data = json_decode($response, true);
    $paystackStatus = $data['data']['status'] ?? 'unknown';
    $gatewayResponse = $data['data']['gateway_response'] ?? '';

    if ($paystackStatus === 'success') {
        // Update transaction as paid
        $storage->updateTransactionPayment($tx['id'], [
            'payment_method'  => 'paystack',
            'mpesa_receipt'   => $ref,
            'payment_status'  => 'paid',
            'payment_date'    => date('Y-m-d H:i:s'),
        ]);
        $pdo->prepare("UPDATE transactions SET status = 'completed' WHERE id = ?")->execute([$tx['id']]);

        // Handle fee → parent completion
        if ($tx['is_fee'] && $tx['parent_transaction_id']) {
            $feeStmt = $pdo->prepare("
                SELECT COUNT(*) as total, 
                       SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as paid
                FROM transactions 
                WHERE parent_transaction_id = ? AND is_fee = 1
            ");
            $feeStmt->execute([$tx['parent_transaction_id']]);
            $feeCounts = $feeStmt->fetch();
            if ($feeCounts['total'] == $feeCounts['paid']) {
                $pdo->prepare("UPDATE transactions SET status = 'completed' WHERE id = ?")->execute([$tx['parent_transaction_id']]);
            }
        }

        $results[] = ['id' => $tx['id'], 'ref' => $ref, 'status' => 'updated_to_paid'];
        $updated++;
    } elseif ($paystackStatus === 'failed' || $paystackStatus === 'abandoned') {
        $storage->updateTransactionPayment($tx['id'], [
            'payment_status'        => 'failed',
            'payment_failure_reason' => "Paystack: {$gatewayResponse}",
        ]);
        $pdo->prepare("UPDATE transactions SET status = 'failed' WHERE id = ?")->execute([$tx['id']]);
        $results[] = ['id' => $tx['id'], 'ref' => $ref, 'status' => 'updated_to_failed', 'reason' => $gatewayResponse];
        $failed++;
    } else {
        $results[] = ['id' => $tx['id'], 'ref' => $ref, 'status' => 'still_pending', 'paystack_status' => $paystackStatus];
    }

    // Rate limit: Paystack allows ~10 req/sec
    usleep(150000); // 150ms between requests
}

echo json_encode([
    'summary' => [
        'total_checked' => count($pending),
        'updated_to_paid' => $updated,
        'updated_to_failed' => $failed,
        'not_found_on_paystack' => $notFound,
    ],
    'details' => $results,
], JSON_PRETTY_PRINT);
