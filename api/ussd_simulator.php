<?php
/**
 * USSD Simulator Endpoint (POST JSON - for frontend testing)
 * 
 * DISPLAY-ONLY MODE: This simulator does NOT write to the database.
 * It uses SimulatorStorage which maintains state in memory only.
 * All menu changes are reflected immediately (no caching).
 * 
 * Protected: Requires admin authentication in production
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/SimulatorStorage.php';
require_once __DIR__ . '/ussd_handler.php';

// Require admin authentication only if explicitly enabled
$requireSimulatorAuth = getenv('SIMULATOR_REQUIRE_AUTH');
$requireSimulatorAuth = $requireSimulatorAuth === 'true' || $requireSimulatorAuth === '1';
if ($requireSimulatorAuth) {
    requireAdminAuth();
}

// Clear opcache to ensure latest code is used (for simulator only)
if (function_exists('opcache_reset')) {
    opcache_reset();
}

try {
    // Get JSON body
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
    
    if (!$data) {
        jsonResponse(['message' => 'Invalid JSON', 'type' => 'END'], 400);
    }
    
    $phoneNumber = $data['phoneNumber'] ?? '';
    $text = $data['text'] ?? '';
    $sessionId = $data['sessionId'] ?? '';
    
    if (empty($phoneNumber) || empty($sessionId)) {
        jsonResponse(['message' => 'Missing required fields', 'type' => 'END'], 400);
    }
    
    // Use SimulatorStorage instead of real Storage - no database writes
    $simulatorStorage = new SimulatorStorage($pdo);
    
    // Debug: Log what the simulator is sending
    error_log("[SIMULATOR] Phone: $phoneNumber | SessionID: $sessionId | Text: $text");
    
    // Call handler with simulator storage (display-only mode)
    $response = handleUSSDSession($phoneNumber, $sessionId, '*519*65#', $text, $simulatorStorage);
    
    // Debug: Log the response
    error_log("[SIMULATOR] Response: " . substr($response, 0, 100));
    
    // Convert CON/END to JSON for simulator
    $isEnd = strpos($response, 'END') === 0;
    $message = preg_replace('/^(CON|END)\s/', '', $response);
    
    jsonResponse([
        'message' => $message,
        'type' => $isEnd ? 'END' : 'CON'
    ]);
    
} catch (Exception $e) {
    // Log detailed error on server
    error_log("USSD Simulator Error: " . $e->getMessage());

    // In development, expose the actual error message to help debugging
    $isDevelopment = getenv('APP_ENV') === 'development'
        || getenv('APP_DEBUG') === 'true'
        || (isset($_ENV['APP_ENV']) && $_ENV['APP_ENV'] === 'development')
        || (isset($_ENV['APP_DEBUG']) && $_ENV['APP_DEBUG'] === 'true');

    if ($isDevelopment) {
        jsonResponse([
            'message' => 'System error: ' . $e->getMessage(),
            'type' => 'END',
        ], 500);
    }

    // In production, keep generic
    jsonResponse(['message' => 'System error', 'type' => 'END'], 500);
}

