<?php
/**
 * API Router
 */

$requestUri = $_SERVER['REQUEST_URI'] ?? '';
$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Remove query string
$path = parse_url($requestUri, PHP_URL_PATH);

// Route to appropriate endpoint (supports both GET and POST for USSD gateway)
if (preg_match('#^/api/ussd$#', $path) && ($requestMethod === 'GET' || $requestMethod === 'POST')) {
    require __DIR__ . '/ussd.php';
    exit;
}

if (preg_match('#^/api/login$#', $path)) {
    require __DIR__ . '/login.php';
    exit;
}

if (preg_match('#^/api/logout$#', $path)) {
    require __DIR__ . '/login.php';
    exit;
}

if (preg_match('#^/api/auth/check$#', $path)) {
    require __DIR__ . '/login.php';
    exit;
}

if (preg_match('#^/api/ussd/simulator$#', $path) && $requestMethod === 'POST') {
    require __DIR__ . '/ussd_simulator.php';
    exit;
}

if (preg_match('#^/api/users/#', $path) && $requestMethod === 'GET') {
    require __DIR__ . '/users.php';
    exit;
}

if (preg_match('#^/api/admin/#', $path)) {
    require __DIR__ . '/admin.php';
    exit;
}

if (preg_match('#^/api/mpesa/callback$#', $path) && $requestMethod === 'POST') {
    require __DIR__ . '/mpesa_callback.php';
    exit;
}

if (preg_match('#^/api/mpesa/stk-push$#', $path) && $requestMethod === 'POST') {
    require __DIR__ . '/mpesa_stk_push.php';
    exit;
}

if (preg_match('#^/api/public/#', $path)) {
    require __DIR__ . '/public.php';
    exit;
}

// 404
http_response_code(404);
header('Content-Type: application/json');
echo json_encode(['error' => 'Not found', 'path' => $path]);

