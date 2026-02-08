<?php
/**
 * USSD Handler Logic
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Storage.php';

$storage = new Storage($pdo);

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
    
    // If INPUT starts with gateway suffix (65), skip it and get user selections
    // Gateway suffix is always the first part, user input starts at index 1
    if (count($parts) > 0 && $parts[0] === '65') {
        // Skip the gateway suffix (65), get user selections
        $userParts = count($parts) > 1 ? array_slice($parts, 1) : [];
    } else {
        // Legacy format: "*519*65#" or "*519*65*1*25000#"
        // Gateway code is first 2 parts (519*65), user input starts at index 2
        $userParts = count($parts) > 2 ? array_slice($parts, 2) : [];
    }
    
    $lastInput = count($userParts) > 0 ? $userParts[count($userParts) - 1] : '';
    
    return ['parts' => $userParts, 'lastInput' => $lastInput];
}

// Helper function to generate a unique reference code
function generateRef() {
    return strtoupper(substr(md5(uniqid(rand(), true)), 0, 8));
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
    error_log("[STK PUSH] Attempting to trigger STK push: Transaction ID {$transactionId}, Phone: {$phoneNumber}, Amount: {$amount}");
    
    // Get the base URL for internal API calls
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? 'localhost';
    $baseUrl = $protocol . '://' . $host;
    
    // Call STK push endpoint internally
    $stkPushUrl = $baseUrl . '/api/mpesa/stk-push';
    
    error_log("[STK PUSH] Calling internal endpoint: {$stkPushUrl}");
    
    $postData = json_encode([
        'transactionId' => $transactionId,
        'phoneNumber' => $phoneNumber,
        'amount' => $amount
    ]);
    
    // Make non-blocking cURL call so STK push happens after USSD response is sent
    $ch = curl_init($stkPushUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Content-Length: ' . strlen($postData)
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10); // 10 second timeout
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_NOSIGNAL, 1); // Non-blocking
    
    // Execute asynchronously (don't wait for response - it will be logged by the STK push endpoint)
    curl_exec($ch);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    if ($curlError) {
        error_log("[STK PUSH ERROR] Failed to trigger STK push for transaction $transactionId: $curlError");
        return false;
    }
    
    // Request initiated successfully (response will be logged by the STK push endpoint)
    return true;
}

// USSD Session Logic Handler
function handleUSSDSession($msisdn, $sessionId, $ussdCode, $input, $storage) {
    global $USSD_MENU_ENABLED;
    
    // Get or create session
    $session = $storage->getOrCreateSession($sessionId, $msisdn, $ussdCode);
    $parsed = parseUSSDInput($input);
    $parts = $parsed['parts'];
    $lastInput = $parsed['lastInput'];
    $level = count($parts);

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
    $user = $storage->getUserByPhoneNumber($msisdn);
    if (!$user) {
        $user = $storage->createUser([
            'phoneNumber' => $msisdn,
            'balance' => '0',
            'loanLimit' => '25100',
            'hasActiveLoan' => false
        ]);
    }
    
    $response = '';
    $shouldEnd = false;
    
    // Check if USSD menu is disabled (redirect to web app)
    // Log the current state for debugging
    error_log("[USSD MENU] USSD_MENU_ENABLED = " . ($USSD_MENU_ENABLED ? 'true' : 'false'));
    
    if (!$USSD_MENU_ENABLED) {
        return "END Our USSD service is temporarily unavailable.\n\nPlease visit:\njengacapital.co.ke/cash\n\nThank you for your understanding.";
    }
    
    $activeCampaign = $storage->getActiveCampaign();
    if (empty($activeCampaign)) {
        return "END No active campaign available. Please try again later.";
    }

    $allNodes = $storage->listCampaignNodes($activeCampaign['id'], false);
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
    $prompt = $currentNode['prompt'] ?? $activeCampaign['root_prompt'];
    $menuBody = $buildMenu($prompt, $children);

    if (count($children) > 0) {
        $storage->updateSession($sessionId, 'campaign_menu:' . $activeCampaign['id'] . ':' . ($currentParentId ?? 'root'), $input);
        $response = "CON " . $menuBody;
    } else if (($currentNode['action_type'] ?? null) === 'bid') {
        $payload = [];
        if (!empty($currentNode['action_payload'])) {
            $decoded = json_decode($currentNode['action_payload'], true);
            if (is_array($decoded)) {
                $payload = $decoded;
            }
        }
        $bidAmount = isset($payload['amount']) ? (float)$payload['amount'] : 0;
        if (!is_finite($bidAmount) || $bidAmount <= 0) {
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

        $bidTransactionId = $storage->createTransaction([
            'userId' => $user['id'],
            'type' => 'bid',
            'amount' => number_format($bidAmount, 2, '.', ''),
            'reference' => $ref,
            'status' => 'pending',
            'source' => 'ussd'
        ]);

        $feeRef = $ref . '-FEE';
        $feeTransactionId = $storage->createFeeTransaction($user['id'], number_format($feeAmount, 2, '.', ''), $feeRef, $bidTransactionId, 'bid_fee', 'ussd');

        $formattedPhone = preg_replace('/[^0-9]/', '', $msisdn);
        if (substr($formattedPhone, 0, 1) === '0') {
            $formattedPhone = '254' . substr($formattedPhone, 1);
        }

        register_shutdown_function(function() use ($feeTransactionId, $formattedPhone, $feeAmount) {
            error_log("[STK PUSH] Triggering bid fee STK push: Transaction ID {$feeTransactionId}, Phone: {$formattedPhone}, Amount: {$feeAmount}");
            triggerSTKPush($feeTransactionId, $formattedPhone, $feeAmount);
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

