<?php
/**
 * USSD Gateway Endpoint (GET or POST - for real USSD gateway)
 * Supports both GET (Advanta default) and POST (if configured)
 */

require_once __DIR__ . '/ussd_handler.php';

try {
    // Start timing for response time calculation
    $startTime = microtime(true);
    
    // Support both GET and POST (Advanta defaults to GET, but POST can be configured)
    $msisdn = $_GET['MSISDN'] ?? $_POST['MSISDN'] ?? '';
    $sessionId = $_GET['SESSIONID'] ?? $_POST['SESSIONID'] ?? '';
    $ussdCode = urldecode($_GET['USSDCODE'] ?? $_POST['USSDCODE'] ?? '');
    $input = urldecode($_GET['INPUT'] ?? $_POST['INPUT'] ?? '');
    
    // Build full URL for logging (like Advanta does)
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? 'localhost';
    $requestUri = $_SERVER['REQUEST_URI'] ?? '';
    $fullUrl = $protocol . '://' . $host . $requestUri;
    
    if (empty($msisdn) || empty($sessionId) || empty($ussdCode)) {
        error_log("[USSD ERROR] Missing required parameters - MSISDN: " . ($msisdn ?: 'empty') . ", SESSIONID: " . ($sessionId ?: 'empty') . ", USSDCODE: " . ($ussdCode ?: 'empty'));
        textResponse("END Invalid request parameters.");
    }

    // Debounce duplicate gateway retries for the same session/input within a short window.
    $debounceSeconds = 10;
    $cacheKey = hash('sha256', $sessionId . '|' . $input . '|' . $ussdCode);
    $cacheFile = sys_get_temp_dir() . "/ussd_cache_{$cacheKey}.txt";
    if (file_exists($cacheFile)) {
        $age = time() - filemtime($cacheFile);
        if ($age >= 0 && $age <= $debounceSeconds) {
            $cachedResponse = @file_get_contents($cacheFile);
            if ($cachedResponse !== false && $cachedResponse !== '') {
                textResponse($cachedResponse);
            }
        }
    }
    
    $response = handleUSSDSession($msisdn, $sessionId, $ussdCode, $input, $storage);
    
    // Calculate response time
    $responseTime = microtime(true) - $startTime;
    $responseTimeFormatted = number_format($responseTime, 4);
    
    // Log in Advanta-style format: timestamp - [ CUSTOM ] path: | URL | Response Time : Full Response
    $responseType = strpos($response, 'CON') === 0 ? 'CON' : 'END';
    
    // Format exactly like Advanta logs
    $logEntry = sprintf(
        "%s - [ CUSTOM ] %s:  | %s : %s %s",
        date('Y-m-d H:i:s'),
        __FILE__,
        $fullUrl,
        $responseTimeFormatted,
        $response
    );
    
    error_log($logEntry);

    // Cache response for quick replay on gateway retries.
    @file_put_contents($cacheFile, $response);
    
    textResponse($response);
    
} catch (Exception $e) {
    error_log("[USSD EXCEPTION] SessionID: " . ($sessionId ?? 'unknown') . " | Error: " . $e->getMessage());
    textResponse("END System error. Please try again later.");
}
