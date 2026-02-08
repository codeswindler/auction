<?php
/**
 * Public API Endpoints for Loan Service Web App
 * These endpoints are accessible without authentication (phone number based)
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Storage.php';

// Configure web app specific log file (separate from main error log)
$webAppLogPath = getenv('APP_ENV') === 'development' 
    ? __DIR__ . '/../logs/web_app.log' 
    : '/var/log/web_app.log';

// Create logs directory if it doesn't exist (for local dev)
if (getenv('APP_ENV') === 'development' && !is_dir(dirname($webAppLogPath))) {
    @mkdir(dirname($webAppLogPath), 0755, true);
}

// Helper function to log to web app log file (separate from error_log)
function webAppLog($message) {
    global $webAppLogPath;
    $timestamp = date('Y-m-d H:i:s');
    $logMessage = sprintf("[%s] %s\n", $timestamp, $message);
    @file_put_contents($webAppLogPath, $logMessage, FILE_APPEND | LOCK_EX);
}

try {
    $storage = new Storage($pdo);
    $method = $_SERVER['REQUEST_METHOD'];
    $path = $_SERVER['REQUEST_URI'] ?? '';
    $rawInput = file_get_contents('php://input');
    $requestBody = json_decode($rawInput, true);
    
    if ($rawInput !== '' && json_last_error() !== JSON_ERROR_NONE) {
        jsonResponse(['error' => 'Invalid JSON in request body: ' . json_last_error_msg()], 400);
    }
} catch (Exception $e) {
    error_log("Public API Error: " . $e->getMessage()); // Keep existing error logging
    webAppLog("Public API Error: " . $e->getMessage()); // Also log to web app log
    jsonResponse(['error' => 'Server error: ' . $e->getMessage()], 500);
}

// Calculate processing fee based on loan amount (max 100k)
function calculateLoanFee($amount) {
    $amount = floatval($amount);
    if ($amount >= 10000 && $amount <= 25100) {
        return 200;
    } else if ($amount > 25100 && $amount <= 50000) {
        return 225;
    } else if ($amount > 50000 && $amount <= 75000) {
        return 250;
    } else if ($amount > 75000 && $amount <= 100000) {
        return 275;
    }
    return 200; // Default for amounts below 10,000
}

// Helper function to format phone number
function formatPhoneNumber($phone) {
    // Remove all non-numeric characters
    $phone = preg_replace('/[^0-9]/', '', $phone);
    
    // If it starts with 254, keep it
    if (substr($phone, 0, 3) === '254') {
        return $phone;
    }
    
    // If it starts with 0, replace with 254
    if (substr($phone, 0, 1) === '0') {
        $phone = '254' . substr($phone, 1);
    }
    
    // If it's 9 digits (without country code), add 254
    if (strlen($phone) === 9) {
        $phone = '254' . $phone;
    }
    
    return $phone;
}

// Helper function to generate reference
function generateRef() {
    return strtoupper(substr(md5(uniqid(rand(), true)), 0, 8));
}

// Helper function to trigger STK push
function triggerSTKPush($transactionId, $phoneNumber, $amount) {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? 'localhost';
    $baseUrl = $protocol . '://' . $host;
    
    $stkPushUrl = $baseUrl . '/api/mpesa/stk-push';
    
    $postData = json_encode([
        'transactionId' => $transactionId,
        'phoneNumber' => $phoneNumber,
        'amount' => $amount
    ]);
    
    $ch = curl_init($stkPushUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Content-Length: ' . strlen($postData)
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_NOSIGNAL, 1);
    
    curl_exec($ch);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    if ($curlError) {
        error_log("[STK PUSH ERROR] Failed to trigger STK push for transaction $transactionId: $curlError");
        return false;
    }
    
    return true;
}

// POST /api/public/log - Frontend logging endpoint
if ($method === 'POST' && preg_match('#^/api/public/log#', $path)) {
    $logData = $requestBody ?? [];
    $action = $logData['action'] ?? 'unknown';
    $step = $logData['step'] ?? null;
    $data = $logData['data'] ?? [];
    
    // Format log message
    $logMessage = sprintf(
        "[WEB APP CLIENT] Action: %s",
        $action
    );
    
    if ($step !== null) {
        $logMessage .= sprintf(" | Step: %s", $step);
    }
    
    if (!empty($data)) {
        $logParts = [];
        foreach ($data as $key => $value) {
            // Handle nested objects/arrays
            if (is_array($value)) {
                $nestedParts = [];
                foreach ($value as $nestedKey => $nestedValue) {
                    // Mask sensitive nested data
                    if (in_array(strtolower($nestedKey), ['password', 'pin', 'cvv'])) {
                        $nestedValue = '***';
                    } elseif (strtolower($nestedKey) === 'mpesanumber' || strtolower($nestedKey) === 'phonenumber') {
                        // Show last 4 digits for phone numbers
                        $nestedValue = strlen($nestedValue) > 4 ? '***' . substr($nestedValue, -4) : $nestedValue;
                    } elseif (strtolower($nestedKey) === 'idnumber') {
                        // Show last 4 digits for ID numbers
                        $nestedValue = strlen($nestedValue) > 4 ? '***' . substr($nestedValue, -4) : $nestedValue;
                    }
                    $nestedParts[] = sprintf("%s: %s", $nestedKey, $nestedValue);
                }
                $logParts[] = sprintf("%s: {%s}", $key, implode(", ", $nestedParts));
            } else {
                // Mask sensitive top-level data
                if (in_array(strtolower($key), ['password', 'pin', 'cvv'])) {
                    $value = '***';
                } elseif (strtolower($key) === 'mpesanumber' || strtolower($key) === 'phonenumber') {
                    // Show last 4 digits for phone numbers
                    $value = strlen($value) > 4 ? '***' . substr($value, -4) : $value;
                } elseif (strtolower($key) === 'idnumber') {
                    // Show last 4 digits for ID numbers
                    $value = strlen($value) > 4 ? '***' . substr($value, -4) : $value;
                }
                $logParts[] = sprintf("%s: %s", $key, $value);
            }
        }
        if (!empty($logParts)) {
            $logMessage .= " | " . implode(" | ", $logParts);
        }
    }
    
    webAppLog($logMessage);
    
    jsonResponse(['success' => true]);
}

// GET /api/public/transactions?phoneNumber=...
if ($method === 'GET' && preg_match('#^/api/public/transactions#', $path)) {
    $phoneNumber = $_GET['phoneNumber'] ?? '';
    $phoneNumber = formatPhoneNumber($phoneNumber);
    
    if (!$phoneNumber) {
        jsonResponse(['error' => 'Phone number required'], 400);
    }
    
    $user = $storage->getUserByPhoneNumber($phoneNumber);
    if (!$user) {
        jsonResponse([]);
    }
    
    // Get all transactions for this user
    $stmt = $pdo->prepare("
        SELECT 
            id,
            type,
            amount,
            reference,
            status,
            payment_status,
            created_at
        FROM transactions 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 50
    ");
    $stmt->execute([$user['id']]);
    $transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    jsonResponse($transactions);
}

// POST /api/public/request-loan
if ($method === 'POST' && preg_match('#^/api/public/request-loan#', $path)) {
    // Log step 1: Request received (to web app log file only)
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    webAppLog(sprintf(
        "[WEB LOAN STEP 1] Request received | IP: %s | User-Agent: %s | Raw Body: %s",
        $clientIp,
        $userAgent,
        substr($rawInput, 0, 500) // Limit log size
    ));
    
    $phoneNumber = $requestBody['phoneNumber'] ?? '';
    $amount = $requestBody['amount'] ?? '';
    $idNumber = $requestBody['idNumber'] ?? '';
    $fullName = $requestBody['fullName'] ?? '';
    $email = $requestBody['email'] ?? '';
    $location = $requestBody['location'] ?? '';
    $employmentStatus = $requestBody['employmentStatus'] ?? '';
    $employerName = $requestBody['employerName'] ?? '';
    $monthlyIncome = $requestBody['monthlyIncome'] ?? '';
    $loanPurpose = $requestBody['loanPurpose'] ?? '';
    
    // Log step 2: Input validation (to web app log file only)
    webAppLog(sprintf(
        "[WEB LOAN STEP 2] Input validation | Phone: %s | Amount: %s | ID: %s | Name: %s | Location: %s | Employment: %s | Income: %s | Purpose: %s",
        $phoneNumber ?: 'empty',
        $amount ?: 'empty',
        $idNumber ?: 'empty',
        $fullName ?: 'empty',
        $location ?: 'empty',
        $employmentStatus ?: 'empty',
        $monthlyIncome ?: 'empty',
        $loanPurpose ?: 'empty'
    ));
    
    $phoneNumber = formatPhoneNumber($phoneNumber);
    
    if (!$phoneNumber || !$amount || !$idNumber) {
        webAppLog("[WEB LOAN STEP 2 ERROR] Missing required fields | Phone: " . ($phoneNumber ?: 'empty') . " | Amount: " . ($amount ?: 'empty') . " | ID: " . ($idNumber ?: 'empty'));
        jsonResponse(['error' => 'Phone number, amount, and ID number are required'], 400);
    }
    
    // Validate amount
    $amount = floatval($amount);
    if ($amount <= 0) {
        webAppLog("[WEB LOAN STEP 2 ERROR] Invalid amount: " . $amount);
        jsonResponse(['error' => 'Invalid amount'], 400);
    }
    if ($amount < 10000) {
        webAppLog("[WEB LOAN STEP 2 ERROR] Amount below minimum: " . $amount);
        jsonResponse(['error' => 'Minimum loan amount is KES 10,000'], 400);
    }
    if ($amount > 100000) {
        webAppLog("[WEB LOAN STEP 2 ERROR] Amount above maximum: " . $amount);
        jsonResponse(['error' => 'Maximum loan amount is KES 100,000'], 400);
    }
    
    // Log step 3: User lookup/creation (to web app log file only)
    webAppLog(sprintf(
        "[WEB LOAN STEP 3] User lookup | Phone: %s | ID: %s",
        $phoneNumber,
        $idNumber
    ));
    
    $user = $storage->getUserByPhoneNumber($phoneNumber);
    if (!$user) {
        webAppLog(sprintf(
            "[WEB LOAN STEP 3] Creating new user | Phone: %s | ID: %s | Name: %s",
            $phoneNumber,
            $idNumber,
            $fullName ?: 'N/A'
        ));
        $user = $storage->createUser([
            'phoneNumber' => $phoneNumber,
            'balance' => '0',
            'loanLimit' => '25100',
            'hasActiveLoan' => false,
            'idNumber' => $idNumber
        ]);
        webAppLog(sprintf(
            "[WEB LOAN STEP 3] New user created | User ID: %s | Phone: %s",
            $user['id'],
            $phoneNumber
        ));
    } else {
        webAppLog(sprintf(
            "[WEB LOAN STEP 3] Existing user found | User ID: %s | Phone: %s | Balance: %s | Loan Limit: %s | Active Loan: %s",
            $user['id'],
            $phoneNumber,
            $user['balance'] ?? '0',
            $user['loan_limit'] ?? '0',
            ($user['has_active_loan'] ?? false) ? 'Yes' : 'No'
        ));
        // Update ID number if provided
        if ($idNumber) {
            $stmt = $pdo->prepare("UPDATE users SET id_number = ? WHERE id = ?");
            $stmt->execute([$idNumber, $user['id']]);
            webAppLog(sprintf(
                "[WEB LOAN STEP 3] Updated user ID number | User ID: %s | New ID: %s",
                $user['id'],
                $idNumber
            ));
        }
    }
    
    // Log step 4: Loan transaction creation (to web app log file only)
    webAppLog(sprintf(
        "[WEB LOAN STEP 4] Creating loan transaction | User ID: %s | Amount: %s | Phone: %s",
        $user['id'],
        $amount,
        $phoneNumber
    ));
    
    // No loan limit restriction for web app - users can select any amount
    $reference = generateRef();
    $transactionId = $storage->createTransaction([
        'userId' => $user['id'],
        'type' => 'loan',
        'amount' => number_format($amount, 2, '.', ''),
        'reference' => $reference,
        'status' => 'pending',
        'source' => 'web'
    ]);
    
    webAppLog(sprintf(
        "[WEB LOAN STEP 4] Loan transaction created | Transaction ID: %s | Reference: %s | Amount: %s | User ID: %s",
        $transactionId,
        $reference,
        number_format($amount, 2, '.', ''),
        $user['id']
    ));
    
    // Log step 5: Fee calculation (to web app log file only)
    $feeAmount = calculateLoanFee($amount);
    webAppLog(sprintf(
        "[WEB LOAN STEP 5] Fee calculation | Loan Amount: %s | Fee Amount: %s",
        number_format($amount, 2, '.', ''),
        $feeAmount
    ));
    
    // Log step 6: Fee transaction creation (to web app log file only)
    $feeReference = generateRef();
    $feeTransactionId = $storage->createFeeTransaction(
        $user['id'],
        number_format($feeAmount, 2, '.', ''),
        $feeReference,
        $transactionId,
        'fee',
        'web'
    );
    
    webAppLog(sprintf(
        "[WEB LOAN STEP 6] Fee transaction created | Fee Transaction ID: %s | Fee Reference: %s | Fee Amount: %s | Parent Transaction ID: %s",
        $feeTransactionId,
        $feeReference,
        number_format($feeAmount, 2, '.', ''),
        $transactionId
    ));
    
    // Log step 7: STK push trigger (to web app log file only)
    webAppLog(sprintf(
        "[WEB LOAN STEP 7] Triggering STK push for fee | Fee Transaction ID: %s | Phone: %s | Amount: %s",
        $feeTransactionId,
        $phoneNumber,
        $feeAmount
    ));
    
    $stkPushResult = triggerSTKPush($feeTransactionId, $phoneNumber, $feeAmount);
    
    if ($stkPushResult) {
        webAppLog(sprintf(
            "[WEB LOAN STEP 7] STK push triggered successfully | Fee Transaction ID: %s | Phone: %s",
            $feeTransactionId,
            $phoneNumber
        ));
    } else {
        webAppLog(sprintf(
            "[WEB LOAN STEP 7 ERROR] STK push failed | Fee Transaction ID: %s | Phone: %s",
            $feeTransactionId,
            $phoneNumber
        ));
    }
    
    // Log step 8: Response sent (to web app log file only)
    webAppLog(sprintf(
        "[WEB LOAN STEP 8] Response sent | Transaction ID: %s | Reference: %s | Fee Amount: %s | Success: Yes",
        $transactionId,
        $reference,
        $feeAmount
    ));
    
    jsonResponse([
        'success' => true,
        'message' => 'Loan request created. Please complete the fee payment via STK push.',
        'transactionId' => $transactionId,
        'reference' => $reference,
        'feeAmount' => $feeAmount
    ]);
}

// POST /api/public/deposit
if ($method === 'POST' && preg_match('#^/api/public/deposit#', $path)) {
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    webAppLog(sprintf(
        "[WEB DEPOSIT STEP 1] Request received | IP: %s | Raw Body: %s",
        $clientIp,
        substr($rawInput, 0, 200)
    ));
    
    $phoneNumber = $requestBody['phoneNumber'] ?? '';
    $amount = $requestBody['amount'] ?? '';
    
    webAppLog(sprintf(
        "[WEB DEPOSIT STEP 2] Input validation | Phone: %s | Amount: %s",
        $phoneNumber ?: 'empty',
        $amount ?: 'empty'
    ));
    
    $phoneNumber = formatPhoneNumber($phoneNumber);
    
    if (!$phoneNumber || !$amount) {
        webAppLog("[WEB DEPOSIT STEP 2 ERROR] Missing required fields");
        jsonResponse(['error' => 'Phone number and amount are required'], 400);
    }
    
    // Validate amount
    $amount = floatval($amount);
    if ($amount <= 0) {
        webAppLog("[WEB DEPOSIT STEP 2 ERROR] Invalid amount: " . $amount);
        jsonResponse(['error' => 'Invalid amount'], 400);
    }
    
    webAppLog(sprintf(
        "[WEB DEPOSIT STEP 3] User lookup | Phone: %s",
        $phoneNumber
    ));
    
    // Get or create user
    $user = $storage->getUserByPhoneNumber($phoneNumber);
    if (!$user) {
        webAppLog(sprintf(
            "[WEB DEPOSIT STEP 3] Creating new user | Phone: %s",
            $phoneNumber
        ));
        $user = $storage->createUser([
            'phoneNumber' => $phoneNumber,
            'balance' => '0',
            'loanLimit' => '25100',
            'hasActiveLoan' => false
        ]);
        webAppLog(sprintf(
            "[WEB DEPOSIT STEP 3] New user created | User ID: %s",
            $user['id']
        ));
    } else {
        webAppLog(sprintf(
            "[WEB DEPOSIT STEP 3] Existing user found | User ID: %s | Balance: %s",
            $user['id'],
            $user['balance'] ?? '0'
        ));
    }
    
    webAppLog(sprintf(
        "[WEB DEPOSIT STEP 4] Creating deposit transaction | User ID: %s | Amount: %s",
        $user['id'],
        $amount
    ));
    
    // Create deposit transaction (from web app)
    $reference = generateRef();
    $transactionId = $storage->createTransaction([
        'userId' => $user['id'],
        'type' => 'deposit',
        'amount' => number_format($amount, 2, '.', ''),
        'reference' => $reference,
        'status' => 'pending',
        'source' => 'web'
    ]);
    
    webAppLog(sprintf(
        "[WEB DEPOSIT STEP 4] Deposit transaction created | Transaction ID: %s | Reference: %s | Amount: %s",
        $transactionId,
        $reference,
        number_format($amount, 2, '.', '')
    ));
    
    webAppLog(sprintf(
        "[WEB DEPOSIT STEP 5] Triggering STK push | Transaction ID: %s | Phone: %s | Amount: %s",
        $transactionId,
        $phoneNumber,
        $amount
    ));
    
    // Trigger STK push for deposit
    $stkPushResult = triggerSTKPush($transactionId, $phoneNumber, $amount);
    
    if ($stkPushResult) {
        webAppLog(sprintf(
            "[WEB DEPOSIT STEP 5] STK push triggered successfully | Transaction ID: %s",
            $transactionId
        ));
    } else {
        webAppLog(sprintf(
            "[WEB DEPOSIT STEP 5 ERROR] STK push failed | Transaction ID: %s",
            $transactionId
        ));
    }
    
    webAppLog(sprintf(
        "[WEB DEPOSIT STEP 6] Response sent | Transaction ID: %s | Reference: %s | Success: Yes",
        $transactionId,
        $reference
    ));
    
    jsonResponse([
        'success' => true,
        'message' => 'Deposit initiated. Please complete the payment via STK push.',
        'transactionId' => $transactionId,
        'reference' => $reference
    ]);
}

// POST /api/public/withdraw
if ($method === 'POST' && preg_match('#^/api/public/withdraw#', $path)) {
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    webAppLog(sprintf(
        "[WEB WITHDRAW STEP 1] Request received | IP: %s | Raw Body: %s",
        $clientIp,
        substr($rawInput, 0, 200)
    ));
    
    $phoneNumber = $requestBody['phoneNumber'] ?? '';
    $amount = $requestBody['amount'] ?? '';
    
    webAppLog(sprintf(
        "[WEB WITHDRAW STEP 2] Input validation | Phone: %s | Amount: %s",
        $phoneNumber ?: 'empty',
        $amount ?: 'empty'
    ));
    
    $phoneNumber = formatPhoneNumber($phoneNumber);
    
    if (!$phoneNumber || !$amount) {
        webAppLog("[WEB WITHDRAW STEP 2 ERROR] Missing required fields");
        jsonResponse(['error' => 'Phone number and amount are required'], 400);
    }
    
    // Validate amount
    $amount = floatval($amount);
    if ($amount <= 0) {
        webAppLog("[WEB WITHDRAW STEP 2 ERROR] Invalid amount: " . $amount);
        jsonResponse(['error' => 'Invalid amount'], 400);
    }
    
    webAppLog(sprintf(
        "[WEB WITHDRAW STEP 3] User lookup | Phone: %s",
        $phoneNumber
    ));
    
    // Get user
    $user = $storage->getUserByPhoneNumber($phoneNumber);
    if (!$user) {
        webAppLog(sprintf(
            "[WEB WITHDRAW STEP 3 ERROR] User not found | Phone: %s",
            $phoneNumber
        ));
        jsonResponse(['error' => 'User not found'], 404);
    }
    
    $balance = floatval($user['balance']);
    webAppLog(sprintf(
        "[WEB WITHDRAW STEP 3] User found | User ID: %s | Balance: %s | Requested Amount: %s",
        $user['id'],
        $balance,
        $amount
    ));
    
    // Check balance
    if ($amount > $balance) {
        webAppLog(sprintf(
            "[WEB WITHDRAW STEP 3 ERROR] Insufficient balance | User ID: %s | Balance: %s | Requested: %s",
            $user['id'],
            $balance,
            $amount
        ));
        jsonResponse(['error' => 'Insufficient balance'], 400);
    }
    
    webAppLog(sprintf(
        "[WEB WITHDRAW STEP 4] Creating withdrawal transaction | User ID: %s | Amount: %s",
        $user['id'],
        $amount
    ));
    
    // Create withdrawal transaction (from web app)
    $reference = generateRef();
    $transactionId = $storage->createTransaction([
        'userId' => $user['id'],
        'type' => 'withdrawal',
        'amount' => number_format($amount, 2, '.', ''),
        'reference' => $reference,
        'status' => 'pending',
        'source' => 'web'
    ]);
    
    webAppLog(sprintf(
        "[WEB WITHDRAW STEP 4] Withdrawal transaction created | Transaction ID: %s | Reference: %s | Amount: %s",
        $transactionId,
        $reference,
        number_format($amount, 2, '.', '')
    ));
    
    // Create fee transaction (KES 50) - inherit source from parent
    $feeAmount = 50;
    $feeReference = generateRef();
    
    webAppLog(sprintf(
        "[WEB WITHDRAW STEP 5] Creating fee transaction | Fee Amount: %s | Parent Transaction ID: %s",
        $feeAmount,
        $transactionId
    ));
    
    $feeTransactionId = $storage->createFeeTransaction(
        $user['id'],
        number_format($feeAmount, 2, '.', ''),
        $feeReference,
        $transactionId,
        'fee',
        'web'
    );
    
    webAppLog(sprintf(
        "[WEB WITHDRAW STEP 5] Fee transaction created | Fee Transaction ID: %s | Fee Reference: %s | Fee Amount: %s",
        $feeTransactionId,
        $feeReference,
        $feeAmount
    ));
    
    // Deduct from balance immediately (will be reversed if payment fails)
    $newBalance = $balance - $amount;
    $storage->updateUserBalance($user['id'], number_format($newBalance, 2, '.', ''));
    
    webAppLog(sprintf(
        "[WEB WITHDRAW STEP 6] Balance updated | User ID: %s | Old Balance: %s | New Balance: %s",
        $user['id'],
        $balance,
        $newBalance
    ));
    
    webAppLog(sprintf(
        "[WEB WITHDRAW STEP 7] Triggering STK push for fee | Fee Transaction ID: %s | Phone: %s | Amount: %s",
        $feeTransactionId,
        $phoneNumber,
        $feeAmount
    ));
    
    // Trigger STK push for fee
    $stkPushResult = triggerSTKPush($feeTransactionId, $phoneNumber, $feeAmount);
    
    if ($stkPushResult) {
        webAppLog(sprintf(
            "[WEB WITHDRAW STEP 7] STK push triggered successfully | Fee Transaction ID: %s",
            $feeTransactionId
        ));
    } else {
        webAppLog(sprintf(
            "[WEB WITHDRAW STEP 7 ERROR] STK push failed | Fee Transaction ID: %s",
            $feeTransactionId
        ));
    }
    
    webAppLog(sprintf(
        "[WEB WITHDRAW STEP 8] Response sent | Transaction ID: %s | Reference: %s | Fee Amount: %s | Success: Yes",
        $transactionId,
        $reference,
        $feeAmount
    ));
    
    jsonResponse([
        'success' => true,
        'message' => 'Withdrawal initiated. Please complete the fee payment via STK push.',
        'transactionId' => $transactionId,
        'reference' => $reference,
        'feeAmount' => $feeAmount
    ]);
}

// 404
jsonResponse(['error' => 'Not found'], 404);

