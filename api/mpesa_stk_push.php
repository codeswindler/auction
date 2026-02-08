<?php
/**
 * M-Pesa STK Push Initiation Endpoint
 * This endpoint initiates STK push payment requests to M-Pesa
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Storage.php';

function stkUserError($message, $statusCode = 500, $details = null) {
    $payload = ['error' => $message];
    if (getenv('APP_ENV') === 'development' && $details !== null) {
        $payload['details'] = $details;
    }
    jsonResponse($payload, $statusCode);
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    stkUserError('Method not allowed', 405);
}

$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
$transactionId = $input['transactionId'] ?? null;
$phoneNumber = $input['phoneNumber'] ?? null;
$amount = $input['amount'] ?? null;

if (!$transactionId || !$phoneNumber || !$amount) {
    stkUserError('Missing required fields: transactionId, phoneNumber, amount', 400);
}

// Get transaction details
$storage = new Storage($pdo);
$transaction = $storage->getTransactionById($transactionId);

if (!$transaction) {
    stkUserError('Transaction not found', 404);
}

// Get M-Pesa credentials from environment
$consumerKey = getenv('MPESA_CONSUMER_KEY');
$consumerSecret = getenv('MPESA_CONSUMER_SECRET');
$passkey = getenv('MPESA_PASSKEY');
$shortcode = getenv('MPESA_SHORTCODE');
$callbackUrl = getenv('MPESA_CALLBACK_URL') ?: 'https://jengacapital.co.ke/api/mpesa/callback';

if (!$consumerKey || !$consumerSecret || !$passkey || !$shortcode) {
    $storage->updateTransactionPayment($transactionId, [
        'payment_status' => 'failed',
        'payment_failure_reason' => 'M-Pesa credentials not configured',
    ]);
    $stmt = $pdo->prepare("UPDATE transactions SET status = 'failed' WHERE id = ?");
    $stmt->execute([$transactionId]);
    stkUserError('Payment service is not configured. Please try again later.');
}

// Format phone number (remove + and ensure it starts with 254)
$originalPhone = $phoneNumber;
$phoneNumber = preg_replace('/[^0-9]/', '', $phoneNumber);
if (substr($phoneNumber, 0, 1) === '0') {
    $phoneNumber = '254' . substr($phoneNumber, 1);
}

// Validate phone number format (must be 12 digits starting with 254)
if (strlen($phoneNumber) !== 12 || substr($phoneNumber, 0, 3) !== '254') {
    error_log("STK Push Error: Invalid phone number format. Original: {$originalPhone}, Formatted: {$phoneNumber}");
    stkUserError('Invalid phone number format. Use 2547XXXXXXXX.', 400);
}

// Generate timestamp and password
$timestamp = date('YmdHis');
$password = base64_encode($shortcode . $passkey . $timestamp);

// Get access token
$accessTokenUrl = getenv('MPESA_ACCESS_TOKEN_URL') ?: 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
$credentials = base64_encode($consumerKey . ':' . $consumerSecret);

$ch = curl_init($accessTokenUrl);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Basic ' . $credentials]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    error_log("M-Pesa Access Token Error: HTTP $httpCode - $response");
    $storage->updateTransactionPayment($transactionId, [
        'payment_status' => 'failed',
        'payment_failure_reason' => 'Failed to get M-Pesa access token',
    ]);
    $stmt = $pdo->prepare("UPDATE transactions SET status = 'failed' WHERE id = ?");
    $stmt->execute([$transactionId]);
    stkUserError('Unable to initiate payment right now. Please try again later.', 500, [
        'httpCode' => $httpCode,
        'response' => $response
    ]);
}

$tokenData = json_decode($response, true);
$accessToken = $tokenData['access_token'] ?? null;

if (!$accessToken) {
    error_log("M-Pesa Access Token Error: Invalid response - $response");
    $storage->updateTransactionPayment($transactionId, [
        'payment_status' => 'failed',
        'payment_failure_reason' => 'Invalid M-Pesa access token response',
    ]);
    $stmt = $pdo->prepare("UPDATE transactions SET status = 'failed' WHERE id = ?");
    $stmt->execute([$transactionId]);
    stkUserError('Unable to initiate payment right now. Please try again later.', 500, [
        'response' => $response
    ]);
}

// Initiate STK Push
$stkPushUrl = getenv('MPESA_STK_PUSH_URL') ?: 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

$merchantRequestID = 'JENGA-' . time() . '-' . $transactionId;
$checkoutRequestID = 'CHECKOUT-' . time() . '-' . $transactionId;

$stkPushData = [
    'BusinessShortCode' => $shortcode,
    'Password' => $password,
    'Timestamp' => $timestamp,
    'TransactionType' => 'CustomerPayBillOnline',
    'Amount' => (int)ceil($amount), // Round up to nearest integer
    'PartyA' => $phoneNumber,
    'PartyB' => $shortcode,
    'PhoneNumber' => $phoneNumber,
    'CallBackURL' => $callbackUrl,
    'AccountReference' => $transaction['reference'],
    'TransactionDesc' => ($transaction['is_fee'] == 1) ? 'Pay fee' : ('LiveAuction - ' . ucfirst($transaction['type'])),
    'MerchantRequestID' => $merchantRequestID,
    'CheckoutRequestID' => $checkoutRequestID
];

// Log STK push request details for debugging
error_log("STK Push Request: Transaction ID {$transactionId}, Phone: {$phoneNumber}, Amount: {$amount}, MerchantRequestID: {$merchantRequestID}");

$ch = curl_init($stkPushUrl);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $accessToken,
    'Content-Type: application/json'
]);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($stkPushData));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
$stkResponse = curl_exec($ch);
$stkHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$stkData = json_decode($stkResponse, true);

// Log full M-Pesa response for debugging
error_log("M-Pesa STK Push Response: " . json_encode($stkData));

if ($stkHttpCode === 200 && isset($stkData['ResponseCode']) && $stkData['ResponseCode'] == '0') {
    // M-Pesa returns CheckoutRequestID in the response - this is what will be in callbacks
    // The response structure is: {"ResponseCode":"0","CustomerMessage":"...","CheckoutRequestID":"ws_CO_..."}
    $mpesaCheckoutRequestID = $stkData['CheckoutRequestID'] ?? null;
    $mpesaMerchantRequestID = $stkData['MerchantRequestID'] ?? $merchantRequestID;
    
    if (!$mpesaCheckoutRequestID) {
        error_log("WARNING: M-Pesa did not return CheckoutRequestID in response. Using our generated one: {$checkoutRequestID}");
        $mpesaCheckoutRequestID = $checkoutRequestID;
    }
    
    // Success - store M-Pesa's CheckoutRequestID (this is what will be in callbacks)
    $storage->updateTransactionPayment($transactionId, [
        'merchant_request_id' => $mpesaMerchantRequestID, // Store M-Pesa's MerchantRequestID (may differ from ours)
        'mpesa_transaction_id' => $mpesaCheckoutRequestID, // Store M-Pesa's CheckoutRequestID (this is what callbacks use)
    ]);
    
    error_log("STK Push stored IDs: Transaction ID {$transactionId}, M-Pesa MerchantRequestID: {$mpesaMerchantRequestID}, M-Pesa CheckoutRequestID: {$mpesaCheckoutRequestID}");
    error_log("STK Push initiated: Transaction ID $transactionId, CheckoutRequestID: $mpesaCheckoutRequestID");
    
    jsonResponse([
        'success' => true,
        'message' => 'STK Push initiated successfully',
        'merchantRequestID' => $mpesaMerchantRequestID,
        'checkoutRequestID' => $mpesaCheckoutRequestID,
        'response' => $stkData
    ]);
} else {
    error_log("STK Push Error: HTTP $stkHttpCode - $stkResponse");
    $storage->updateTransactionPayment($transactionId, [
        'payment_status' => 'failed',
        'payment_failure_reason' => $stkData['ResponseDescription'] ?? 'STK push failed',
    ]);
    $stmt = $pdo->prepare("UPDATE transactions SET status = 'failed' WHERE id = ?");
    $stmt->execute([$transactionId]);
    stkUserError('We could not initiate the M-Pesa prompt. Please try again shortly.', 500, [
        'httpCode' => $stkHttpCode,
        'response' => $stkData
    ]);
}

