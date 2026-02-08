<?php
/**
 * Admin Login Endpoint
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = $_SERVER['REQUEST_URI'] ?? '';

// POST /api/login
if ($method === 'POST' && preg_match('#^/api/login$#', $path)) {
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
    
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';
    
    if (empty($username) || empty($password)) {
        jsonResponse(['error' => 'Username and password required'], 400);
    }
    
    if (loginAdmin($username, $password)) {
        jsonResponse([
            'success' => true,
            'message' => 'Login successful'
        ]);
    } else {
        jsonResponse(['error' => 'Invalid credentials'], 401);
    }
}

// POST /api/logout
if ($method === 'POST' && preg_match('#^/api/logout$#', $path)) {
    logoutAdmin();
    jsonResponse(['success' => true, 'message' => 'Logged out']);
}

// GET /api/auth/check
if ($method === 'GET' && preg_match('#^/api/auth/check$#', $path)) {
    jsonResponse([
        'authenticated' => isAdminLoggedIn(),
        'username' => $_SESSION['admin_username'] ?? null
    ]);
}

jsonResponse(['error' => 'Not found'], 404);

