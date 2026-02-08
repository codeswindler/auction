<?php
/**
 * User API Endpoint
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Storage.php';

$storage = new Storage($pdo);

$method = $_SERVER['REQUEST_METHOD'];
$path = $_SERVER['REQUEST_URI'] ?? '';

// GET /api/users/:phoneNumber
if ($method === 'GET' && preg_match('#/api/users/([^/]+)#', $path, $matches)) {
    $phoneNumber = $matches[1];
    $user = $storage->getUserByPhoneNumber($phoneNumber);
    
    if (!$user) {
        jsonResponse(null);
    }
    
    jsonResponse([
        'phoneNumber' => $user['phone_number'],
        'balance' => $user['balance'],
        'loanLimit' => $user['loan_limit']
    ]);
}

jsonResponse(['error' => 'Not found'], 404);

