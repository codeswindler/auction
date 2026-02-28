<?php
/**
 * USSD Handler Logic
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Storage.php';
require_once __DIR__ . '/onfon-sms.service.php';

$storage = new Storage($pdo);
$onfonSms = new OnfonSmsService();

// USSD Menu Toggle: Set to false to hide menu and show redirect message
// Set to true to restore the full USSD menu when you have a new provider
$USSD_MENU_ENABLED = true;

// Helper function to parse INPUT and extract the latest user selection
function parseUSSDInput($input) {
    // INPUT format from Advanta:
    // - Initial: "65" (just gateway suffix)
    // - With selections: "65*1", "65*1*25000", etc.
    // 
    // Remove leading * and trailing # if present
    $cleaned = preg_replace('/^\*/', '', preg_replace('/#$/', '', $input));
    $parts = explode('*', $cleaned);

    $startsWithStar = strpos($input, '*') === 0;
    $endsWithHash = substr($input, -1) === '#';
    $gatewaySuffixes = ['65', '63', '22'];

    if (count($parts) > 0 && in_array($parts[0], $gatewaySuffixes, true)) {
        // INPUT starts with gateway suffix (e.g. 63 or 65), user input starts at index 1
        $userParts = count($parts) > 1 ? array_slice($parts, 1) : [];
    } elseif (count($parts) > 1 && in_array($parts[1], $gatewaySuffixes, true)) {
        // Legacy format: "*519*65#" or "*519*65*1*25000#"
        // Gateway code is first 2 parts (519*65), user input starts at index 2
        $userParts = count($parts) > 2 ? array_slice($parts, 2) : [];
    } elseif (count($parts) > 1 && $startsWithStar) {
        // Shortcode format: "*123*1#" -> treat first part as service code
        $userParts = array_slice($parts, 1);
    } elseif (count($parts) === 1) {
        // Dial only: "*123#" -> no selections yet
        if ($startsWithStar && $endsWithHash) {
            $userParts = [];
        } else {
            $userParts = [$parts[0]];
        }
    } else {
        $userParts = [];
    }
    
    $lastInput = count($userParts) > 0 ? $userParts[count($userParts) - 1] : '';
    
    return ['parts' => $userParts, 'lastInput' => $lastInput];
}

// Helper function to generate a unique reference code (7 chars: BMSDX0J format)
function generateRef() {
    $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $ref = '';
    for ($i = 0; $i < 7; $i++) {
        $ref .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $ref;
}

// Helper function to validate numeric input (for ID numbers and menu selections)
function isValidNumeric($input) {
    // Check if input contains only digits (0-9)
    return preg_match('/^[0-9]+$/', $input) === 1;
}

/**
 * Helper function to trigger STK push for a transaction
 */
function triggerSTKPush($transactionId, $phoneNumber, $amount) {
    // Log the attempt
    $logMessage = "[STK PUSH] Attempting to trigger STK push: Transaction ID {$transactionId}, Phone: {$phoneNumber}, Amount: {$amount}";
    error_log($logMessage);
    
    // Also write to dedicated log file
    $stkLogFile = '/var/log/stk_push.log';
    @file_put_contents($stkLogFile, date('Y-m-d H:i:s') . ' - ' . $logMessage . "\n", FILE_APPEND);
    
    // Get the base URL for internal API calls
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? 'localhost';
    $baseUrl = $protocol . '://' . $host;
    
    // Call STK push endpoint internally
    $stkPushUrl = $baseUrl . '/api/mpesa/stk-push';
    
    error_log("[STK PUSH] Calling internal endpoint: {$stkPushUrl}");
    @file_put_contents($stkLogFile, date('Y-m-d H:i:s') . " - [STK PUSH] Calling endpoint: {$stkPushUrl}\n", FILE_APPEND);
    
    $postData = json_encode([
        'transactionId' => $transactionId,
        'phoneNumber' => $phoneNumber,
        'amount' => $amount
    ]);
    
    // Make cURL call to trigger STK push
    $ch = curl_init($stkPushUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Content-Length: ' . strlen($postData)
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30); // 30 second timeout
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    
    // Execute the request and capture response
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    if ($curlError) {
        $errorMsg = "[STK PUSH ERROR] Failed to trigger STK push for transaction $transactionId: $curlError";
        error_log($errorMsg);
        @file_put_contents($stkLogFile, date('Y-m-d H:i:s') . ' - ' . $errorMsg . "\n", FILE_APPEND);
        return false;
    }
    
    // Log the response
    $responseMsg = "[STK PUSH] Response for transaction {$transactionId}: HTTP {$httpCode} - " . substr($response, 0, 200);
    error_log($responseMsg);
    @file_put_contents($stkLogFile, date('Y-m-d H:i:s') . ' - ' . $responseMsg . "\n", FILE_APPEND);
    
    if ($httpCode >= 200 && $httpCode < 300) {
        return true;
    } else {
        error_log("[STK PUSH ERROR] HTTP {$httpCode} response for transaction {$transactionId}");
        @file_put_contents($stkLogFile, date('Y-m-d H:i:s') . " - [STK PUSH ERROR] HTTP {$httpCode} response\n", FILE_APPEND);
        return false;
    }
}

// USSD Session Logic Handler
function handleUSSDSession($msisdn, $sessionId, $ussdCode, $input, $storage) {
    global $USSD_MENU_ENABLED, $pdo, $onfonSms;
    
    // Get or create session
    $session = $storage->getOrCreateSession($sessionId, $msisdn, $ussdCode);
    
    // Fix: If INPUT is just a plain number (like "22" from *855*22#) and this is the first interaction
    // (empty input_history), treat it as the initial dial to show the root menu
    // BUT: If INPUT contains * (like "22*3"), it's a selection, so parse it normally
    $isPlainNumber = preg_match('/^[0-9]+$/', $input) === 1 && strpos($input, '*') === false && strpos($input, '#') === false;
    $isFirstInteraction = empty($session['input_history']) || $session['input_history'] === '';
    
    if ($isFirstInteraction && $isPlainNumber) {
        // This is the first dial with a plain number (no selections) - ignore it and show root menu
        error_log("[USSD FIX] First dial detected with plain number input: '$input' - treating as initial dial (empty input_history)");
        $parsed = ['parts' => [], 'lastInput' => ''];
        $parts = [];
        $lastInput = '';
        $level = 0;
    } else {
        // Normal parsing - includes selections like "22*3" or "3"
        $parsed = parseUSSDInput($input);
        $parts = $parsed['parts'];
        $lastInput = $parsed['lastInput'];
        $level = count($parts);
    }

    // Log USSD session step details with full debugging info
    // Use a simple cache file to prevent duplicate logging from gateway retries
    $logCacheFile = sys_get_temp_dir() . '/ussd_log_cache_' . md5($sessionId . $input);
    $cacheTimeout = 2; // 2 seconds cache
    
    if (!file_exists($logCacheFile) || (time() - filemtime($logCacheFile)) > $cacheTimeout) {
    error_log(sprintf(
        "[USSD STEP] SessionID: %s | Phone: %s | RawInput: %s | ParsedParts: [%s] | Level: %d | LastInput: %s | Parts[0]: %s | CurrentMenu: %s",
        $sessionId,
        $msisdn,
        $input,
        implode('*', $parts),
        $level,
        $lastInput ?: 'none',
        $parts[0] ?? 'empty',
        $session['current_menu'] ?? 'unknown'
    ));
        // Create cache file to prevent duplicate logging
        touch($logCacheFile);
    }
    
    // Get or create user    
    // Get or create user
    try {
        $user = $storage->getUserByPhoneNumber($msisdn);
        $isNewUser = false;
        if (!$user) {
            $user = $storage->createUser([
                'phoneNumber' => $msisdn,
                'balance' => '0',
                'loanLimit' => '25100',
                'hasActiveLoan' => false
            ]);
            $isNewUser = true;
        }
    } catch (Exception $e) {
        error_log("[USSD ERROR] Failed to get/create user for {$msisdn}: " . $e->getMessage());
        error_log("[USSD ERROR] Stack trace: " . $e->getTraceAsString());
        return "END System error. Please try again later.";
    }
    
    // Check if this is first time dialing (no previous transactions)
    $isFirstDial = false;
    try {
        if (!$isNewUser) {
            $stmt = $pdo->prepare("SELECT COUNT(*) as tx_count FROM transactions WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $txCount = $stmt->fetch()['tx_count'] ?? 0;
            $isFirstDial = ($txCount == 0);
        } else {
            $isFirstDial = true;
        }
    } catch (Exception $e) {
        error_log("[USSD ERROR] Failed to check transaction count for user {$user['id']}: " . $e->getMessage());
        // Default to not first dial to avoid sending duplicate welcome SMS
        $isFirstDial = false;
    }
    
    // Send welcome SMS on first dial (only at root menu, not on subsequent interactions)
    if ($isFirstDial && $level == 0 && empty($parts)) {
        $template = $storage->getRandomSmsTemplate('welcome');
        if ($template && !empty($template['template_text'])) {
            $welcomeMessage = $template['template_text'];
            // Welcome templates don't need {amount} or {reference} replacement
            error_log("[USSD WELCOME] Sending welcome SMS to first-time user: {$msisdn}");
            $smsResult = $onfonSms->send($msisdn, $welcomeMessage);
            if ($smsResult['status'] === 'success') {
                error_log("[USSD WELCOME] Welcome SMS sent successfully to {$msisdn}");
            } else {
                error_log("[USSD WELCOME] Welcome SMS failed: " . ($smsResult['message'] ?? 'Unknown error'));
            }
        }
    }
    
    $response = '';
    $shouldEnd = false;
    
    // Check if USSD menu is disabled (redirect to web app)
    // Log the current state for debugging
    error_log("[USSD MENU] USSD_MENU_ENABLED = " . ($USSD_MENU_ENABLED ? 'true' : 'false'));
    
    if (!$USSD_MENU_ENABLED) {
        return "END Our USSD service is temporarily unavailable.\n\nPlease visit:\njengacapital.co.ke/cash\n\nThank you for your understanding.";
    }
    
    try {
        $activeCampaign = $storage->getActiveCampaign();
        if (empty($activeCampaign)) {
            error_log("[USSD ERROR] No active campaign found for phone {$msisdn}");
            return "END No active campaign available. Please try again later.";
        }
    } catch (Exception $e) {
        error_log("[USSD ERROR] Failed to get active campaign for phone {$msisdn}: " . $e->getMessage());
        return "END System error. Please try again later.";
    }

    try {
        $allNodes = $storage->listCampaignNodes($activeCampaign['id'], false);
    } catch (Exception $e) {
        error_log("[USSD ERROR] Failed to list campaign nodes for campaign {$activeCampaign['id']}: " . $e->getMessage());
        return "END System error. Please try again later.";
    }
    $nodesByParent = [];
    foreach ($allNodes as $node) {
        $parentKey = $node['parent_id'] ?? null;
        $key = $parentKey === null ? 'root' : (string)$parentKey;
        if (!isset($nodesByParent[$key])) {
            $nodesByParent[$key] = [];
        }
        $nodesByParent[$key][] = $node;
    }

    $sortNodes = function($nodes) {
        usort($nodes, function($a, $b) {
            $orderA = isset($a['sort_order']) ? (int)$a['sort_order'] : 0;
            $orderB = isset($b['sort_order']) ? (int)$b['sort_order'] : 0;
            if ($orderA === $orderB) {
                return (int)$a['id'] <=> (int)$b['id'];
            }
            return $orderA <=> $orderB;
        });
        return $nodes;
    };

    $getChildren = function($parentId) use ($nodesByParent, $sortNodes) {
        $key = $parentId === null ? 'root' : (string)$parentId;
        $children = $nodesByParent[$key] ?? [];
        return $sortNodes($children);
    };

    $buildMenu = function($prompt, $children) {
        $menuLines = [];
        foreach ($children as $index => $node) {
            $line = ($index + 1) . ". " . ($node['label'] ?? '');
            if (($node['action_type'] ?? null) === 'bid' && !empty($node['action_payload'])) {
                $payload = json_decode($node['action_payload'], true);
                $amount = isset($payload['amount']) ? (float)$payload['amount'] : 0;
                if ($amount > 0) {
                    $line .= "-KES " . number_format($amount, 0, '.', ',');
                }
            }
            $menuLines[] = $line;
        }
        $menuText = trim($prompt ?? '');
        if (!empty($menuLines)) {
            $menuText = trim($menuText . "\n" . implode("\n", $menuLines));
        }
        return $menuText;
    };

    $currentParentId = null;
    $currentNode = null;
    foreach ($parts as $part) {
        if (!isValidNumeric($part)) {
            $menu = $buildMenu($currentNode['prompt'] ?? $activeCampaign['root_prompt'], $getChildren($currentParentId));
            $storage->updateSession($sessionId, 'campaign_menu_invalid', $input);
            return "CON Invalid selection. Please try again.\n" . $menu;
        }

        $selection = intval($part);
        $siblings = $getChildren($currentParentId);
        if ($selection < 1 || $selection > count($siblings)) {
            $menu = $buildMenu($currentNode['prompt'] ?? $activeCampaign['root_prompt'], $siblings);
            $storage->updateSession($sessionId, 'campaign_menu_invalid', $input);
            return "CON Invalid selection. Please try again.\n" . $menu;
        }

        $currentNode = $siblings[$selection - 1];
        $currentParentId = $currentNode['id'];
    }

    $children = $getChildren($currentParentId);
    $prompt = $currentNode ? ($currentNode['prompt'] ?? $activeCampaign['root_prompt']) : $activeCampaign['root_prompt'];
    $menuBody = $buildMenu($prompt, $children);

    // Debug logging
    if ($currentNode) {
        error_log("[USSD DEBUG] Current node: ID={$currentNode['id']}, Label={$currentNode['label']}, ActionType={$currentNode['action_type']}, ChildrenCount=" . count($children));
    } else {
        error_log("[USSD DEBUG] Current node: null (root menu), ChildrenCount=" . count($children));
    }

    if (count($children) > 0) {
        $storage->updateSession($sessionId, 'campaign_menu:' . $activeCampaign['id'] . ':' . ($currentParentId ?? 'root'), $input);
        $response = "CON " . $menuBody;
    } else if (($currentNode['action_type'] ?? null) === 'bid') {
        error_log("[USSD DEBUG] Bid action detected for node: {$currentNode['label']}");
        
        // Also log to dedicated file
        $ussdLogFile = '/var/log/ussd_debug.log';
        @file_put_contents($ussdLogFile, date('Y-m-d H:i:s') . " - [BID ACTION] Node: {$currentNode['label']}, Phone: {$msisdn}\n", FILE_APPEND);
        
        $payload = [];
        if (!empty($currentNode['action_payload'])) {
            $decoded = json_decode($currentNode['action_payload'], true);
            if (is_array($decoded)) {
                $payload = $decoded;
            }
        }
        $bidAmount = isset($payload['amount']) ? (float)$payload['amount'] : 0;
        if (!is_finite($bidAmount) || $bidAmount <= 0) {
            error_log("[USSD ERROR] Invalid bid amount: {$bidAmount}");
            @file_put_contents($ussdLogFile, date('Y-m-d H:i:s') . " - [ERROR] Invalid bid amount: {$bidAmount}\n", FILE_APPEND);
            return "END Invalid campaign configuration. Please try again later.";
        }

        $ref = generateRef();
        $minFee = isset($activeCampaign['bid_fee_min']) ? floatval($activeCampaign['bid_fee_min']) : 30;
        $maxFee = isset($activeCampaign['bid_fee_max']) ? floatval($activeCampaign['bid_fee_max']) : 99;
        $low = max(0, min($minFee, $maxFee));
        $high = max(0, max($minFee, $maxFee));
        $feeAmount = rand((int)$low, (int)$high);
        $promptTemplate = $activeCampaign['bid_fee_prompt'] ?? "Please complete the bid on MPesa, ref: {{ref}}.";
        $promptMessage = preg_replace('/\{\{\s*ref\s*\}\}/i', $ref, $promptTemplate);
        $response = "END " . $promptMessage;
        $shouldEnd = true;

        // Dedicated log file for USSD debugging
        $ussdLogFile = '/var/log/ussd_debug.log';
        
        error_log("[USSD BID] Creating bid transaction: Ref={$ref}, Amount={$bidAmount}, Fee={$feeAmount}");
        @file_put_contents($ussdLogFile, date('Y-m-d H:i:s') . " - [BID TX] Creating: Ref={$ref}, Amount={$bidAmount}, Fee={$feeAmount}\n", FILE_APPEND);

        try {
            $bidTransactionId = $storage->createTransaction([
                'userId' => $user['id'],
                'type' => 'bid',
                'amount' => number_format($bidAmount, 2, '.', ''),
                'reference' => $ref,
                'status' => 'pending',
                'source' => 'ussd'
            ]);
            
            error_log("[USSD BID] Bid transaction created: ID={$bidTransactionId}");
            @file_put_contents($ussdLogFile, date('Y-m-d H:i:s') . " - [BID TX] Created bid transaction ID: {$bidTransactionId}\n", FILE_APPEND);
            
            // Store bid selection (product label) in payment_name field for display
            $bidLabel = $currentNode['label'] ?? 'Unknown';
            $stmt = $pdo->prepare("UPDATE transactions SET payment_name = ? WHERE id = ?");
            $stmt->execute([$bidLabel, $bidTransactionId]);

            $feeRef = $ref . '-FEE';
            $feeTransactionId = $storage->createFeeTransaction($user['id'], number_format($feeAmount, 2, '.', ''), $feeRef, $bidTransactionId, 'bid_fee', 'ussd');
            
            error_log("[USSD BID] Fee transaction created: ID={$feeTransactionId}, Ref={$feeRef}");
            @file_put_contents($ussdLogFile, date('Y-m-d H:i:s') . " - [BID TX] Created fee transaction ID: {$feeTransactionId}, Ref: {$feeRef}\n", FILE_APPEND);
        } catch (Exception $e) {
            error_log("[USSD ERROR] Failed to create transactions: " . $e->getMessage());
            @file_put_contents($ussdLogFile, date('Y-m-d H:i:s') . " - [ERROR] Transaction creation failed: " . $e->getMessage() . "\n", FILE_APPEND);
            return "END System error. Please try again later.";
        }

        $formattedPhone = preg_replace('/[^0-9]/', '', $msisdn);
        if (substr($formattedPhone, 0, 1) === '0') {
            $formattedPhone = '254' . substr($formattedPhone, 1);
        }

        // Log immediately that we're about to trigger STK push
        error_log("[STK PUSH] Preparing to trigger bid fee STK push: Transaction ID {$feeTransactionId}, Phone: {$formattedPhone}, Amount: {$feeAmount}");
        @file_put_contents($ussdLogFile, date('Y-m-d H:i:s') . " - [STK PUSH] Preparing: TX ID={$feeTransactionId}, Phone={$formattedPhone}, Amount={$feeAmount}\n", FILE_APPEND);
        
        // Use register_shutdown_function to trigger STK push after USSD response is sent
        // This ensures the USSD response is sent first, then STK push happens
        register_shutdown_function(function() use ($feeTransactionId, $formattedPhone, $feeAmount, $ussdLogFile) {
            // Write to both error_log and a dedicated log file for visibility
            $logMessage = "[STK PUSH] Triggering bid fee STK push: Transaction ID {$feeTransactionId}, Phone: {$formattedPhone}, Amount: {$feeAmount}";
            error_log($logMessage);
            
            // Also write to a dedicated log file
            $stkLogFile = '/var/log/stk_push.log';
            @file_put_contents($stkLogFile, date('Y-m-d H:i:s') . ' - ' . $logMessage . "\n", FILE_APPEND);
            @file_put_contents($ussdLogFile, date('Y-m-d H:i:s') . ' - ' . $logMessage . "\n", FILE_APPEND);
            
            $result = triggerSTKPush($feeTransactionId, $formattedPhone, $feeAmount);
            
            $resultMessage = $result ? "SUCCESS" : "FAILED";
            error_log("[STK PUSH] Result for transaction {$feeTransactionId}: {$resultMessage}");
            @file_put_contents($stkLogFile, date('Y-m-d H:i:s') . ' - [STK PUSH] Result: ' . $resultMessage . "\n", FILE_APPEND);
            @file_put_contents($ussdLogFile, date('Y-m-d H:i:s') . ' - [STK PUSH] Result: ' . $resultMessage . "\n", FILE_APPEND);
        });

        $storage->updateSession($sessionId, 'bid_payment', $input);
    } else {
        $response = "END Thank you for using our service.";
    }
    
    // Safety check: ensure response is always set
    if (empty($response)) {
        error_log("[USSD ERROR] Empty response detected - SessionID: $sessionId | Level: $level | Parts: " . implode('*', $parts) . " | LastInput: $lastInput");
        $response = "CON System error. Please try again.\n" . $menuBody;
    }
    
    // Log the response being sent
    $responseType = strpos($response, 'CON') === 0 ? 'CON' : 'END';
    $responsePreview = substr(preg_replace('/\n/', ' ', $response), 0, 80);
    error_log(sprintf(
        "[USSD RESPONSE] SessionID: %s | Type: %s | Menu: %s | Preview: %s",
        $sessionId,
        $responseType,
        $session['current_menu'] ?? 'unknown',
        $responsePreview
    ));
    
    return $response;
}

