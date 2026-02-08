<?php
/**
 * Admin API Endpoints
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/Storage.php';

// Require admin authentication for all admin endpoints
requireAdminAuth();

$storage = new Storage($pdo);

$method = $_SERVER['REQUEST_METHOD'];
$path = $_SERVER['REQUEST_URI'] ?? '';

// GET /api/admin/users
if ($method === 'GET' && preg_match('#/api/admin/users$#', $path)) {
    try {
        $users = $storage->getAllUsers();
        $result = array_map(function($u) {
            return [
                'id' => (int)$u['id'],
                'phoneNumber' => $u['phone_number'],
                'idNumber' => $u['id_number'],
                'balance' => $u['balance'],
                'loanLimit' => $u['loan_limit'],
                'hasActiveLoan' => (bool)$u['has_active_loan'],
            ];
        }, $users);
        jsonResponse($result);
    } catch (Exception $e) {
        error_log("Admin users list error: " . $e->getMessage());
        jsonResponse(['message' => 'Error fetching users'], 500);
    }
}

// GET /api/admin/users/:id
if ($method === 'GET' && preg_match('#/api/admin/users/(\d+)#', $path, $matches)) {
    try {
        $id = (int)$matches[1];
        $user = $storage->getUserById($id);
        
        if (!$user) {
            jsonResponse(null);
        }
        
        jsonResponse([
            'id' => (int)$user['id'],
            'phoneNumber' => $user['phone_number'],
            'idNumber' => $user['id_number'],
            'balance' => $user['balance'],
            'loanLimit' => $user['loan_limit'],
            'hasActiveLoan' => (bool)$user['has_active_loan'],
        ]);
    } catch (Exception $e) {
        error_log("Admin user detail error: " . $e->getMessage());
        jsonResponse(['message' => 'Error fetching user'], 500);
    }
}

// GET /api/admin/transactions (with optional filters)
if ($method === 'GET' && preg_match('#/api/admin/transactions#', $path)) {
    try {
        // Get filter parameters from query string
        $typeFilter = isset($_GET['type']) && $_GET['type'] !== 'all' ? $_GET['type'] : null;
        $statusFilter = isset($_GET['status']) && $_GET['status'] !== 'all' ? $_GET['status'] : null;
        $isFeeFilter = isset($_GET['is_fee']) ? $_GET['is_fee'] : null; // true, false, or null for all
        $sourceFilter = isset($_GET['source']) && $_GET['source'] !== 'all' ? $_GET['source'] : null;
        $phoneNumberFilter = isset($_GET['phone_number']) && $_GET['phone_number'] !== '' ? $_GET['phone_number'] : null;
        $dateFrom = isset($_GET['date_from']) && $_GET['date_from'] !== '' ? $_GET['date_from'] : null;
        $dateTo = isset($_GET['date_to']) && $_GET['date_to'] !== '' ? $_GET['date_to'] : null;
        $limit = isset($_GET['limit']) && $_GET['limit'] > 0 ? (int)$_GET['limit'] : null;
        
        // Log filters for debugging (remove in production)
        error_log("Transaction filters - type: " . ($typeFilter ?? 'null') . ", status: " . ($statusFilter ?? 'null') . ", is_fee: " . ($isFeeFilter ?? 'null') . ", source: " . ($sourceFilter ?? 'null') . ", phone: " . ($phoneNumberFilter ?? 'null'));
        
        $transactions = $storage->getAllTransactions($typeFilter, $statusFilter, null, null, $dateFrom, $dateTo, $limit, $isFeeFilter, $sourceFilter, $phoneNumberFilter);
        $result = array_map(function($t) {
            return [
                'id' => (int)$t['id'],
                'userId' => (int)$t['user_id'],
                'phoneNumber' => $t['phone_number'] ?? null, // Include phone number from join
                'type' => $t['type'],
                'amount' => $t['amount'],
                'reference' => $t['reference'],
                'status' => $t['status'],
                'paymentMethod' => $t['payment_method'] ?? null,
                'mpesaReceipt' => $t['mpesa_receipt'] ?? null,
                'mpesaTransactionId' => $t['mpesa_transaction_id'] ?? null,
                'paymentPhone' => $t['payment_phone'] ?? null,
                'paymentName' => $t['payment_name'] ?? null,
                'paymentStatus' => $t['payment_status'] ?? $t['status'],
                'paymentDate' => $t['payment_date'] ?? null,
                'isFee' => (bool)($t['is_fee'] ?? false),
                'parentTransactionId' => $t['parent_transaction_id'] ? (int)$t['parent_transaction_id'] : null,
                'source' => $t['source'] ?? 'ussd', // 'ussd' or 'web'
                'createdAt' => $t['created_at'],
            ];
        }, $transactions);
        jsonResponse($result);
    } catch (Exception $e) {
        error_log("Admin transactions list error: " . $e->getMessage());
        jsonResponse(['message' => 'Error fetching transactions'], 500);
    }
}

// GET /api/admin/check-super-admin - Check if current user is super admin
if ($method === 'GET' && preg_match('#/api/admin/check-super-admin$#', $path)) {
    $superAdminUsername = getenv('ADMIN_USERNAME');
    $currentUsername = $_SESSION['admin_username'] ?? null;
    $isSuperAdmin = ($superAdminUsername && $currentUsername === $superAdminUsername);
    jsonResponse(['isSuperAdmin' => $isSuperAdmin]);
}

// GET /api/admin/admins - List all admin users
if ($method === 'GET' && preg_match('#/api/admin/admins$#', $path)) {
    try {
        // Try to query admins table - if it doesn't exist, catch will return empty array
        $stmt = $pdo->query("SELECT id, username, created_at, last_login, is_active FROM admins ORDER BY created_at DESC");
        $admins = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Ensure we always return an array
        if (!is_array($admins)) {
            $admins = [];
        }
        
        $result = array_map(function($a) {
            return [
                'id' => (int)$a['id'],
                'username' => $a['username'],
                'createdAt' => $a['created_at'],
                'lastLogin' => $a['last_login'],
                'isActive' => (bool)$a['is_active'],
            ];
        }, $admins);
        jsonResponse($result);
    } catch (Exception $e) {
        error_log("Admin list error: " . $e->getMessage());
        // Always return an array, even on error
        jsonResponse([]);
    }
}

// POST /api/admin/admins - Create a new admin user
// Only super admin (from env) can create new admin users
if ($method === 'POST' && preg_match('#/api/admin/admins$#', $path)) {
    try {
        // Check if current user is super admin from environment
        $superAdminUsername = getenv('ADMIN_USERNAME');
        $currentUsername = $_SESSION['admin_username'] ?? null;
        
        if (!$superAdminUsername || $currentUsername !== $superAdminUsername) {
            jsonResponse(['error' => 'Only super admin can create new admin users'], 403);
        }
        
        $json = file_get_contents('php://input');
        $data = json_decode($json, true);
        
        $username = $data['username'] ?? '';
        $password = $data['password'] ?? '';
        $superAdminPassword = $data['superAdminPassword'] ?? '';
        
        if (empty($username) || empty($password)) {
            jsonResponse(['error' => 'Username and password are required'], 400);
        }
        
        // Verify super admin password (from environment)
        if (empty($superAdminPassword)) {
            jsonResponse(['error' => 'Super admin password is required to create new admin users'], 400);
        }
        
        $envAdminPassword = getenv('ADMIN_PASSWORD');
        if (!$envAdminPassword || $superAdminPassword !== $envAdminPassword) {
            jsonResponse(['error' => 'Invalid super admin password'], 401);
        }
        
        // Validate username (alphanumeric, underscore, dash, 3-50 chars)
        if (!preg_match('/^[a-zA-Z0-9_-]{3,50}$/', $username)) {
            jsonResponse(['error' => 'Username must be 3-50 characters and contain only letters, numbers, underscores, and dashes'], 400);
        }
        
        // Validate password (minimum 8 characters)
        if (strlen($password) < 8) {
            jsonResponse(['error' => 'Password must be at least 8 characters'], 400);
        }
        
        // Check if username already exists
        $checkStmt = $pdo->prepare("SELECT id FROM admins WHERE username = ?");
        $checkStmt->execute([$username]);
        if ($checkStmt->fetch()) {
            jsonResponse(['error' => 'Username already exists'], 400);
        }
        
        // Hash password
        $passwordHash = password_hash($password, PASSWORD_BCRYPT);
        
        // Insert new admin
        $stmt = $pdo->prepare("INSERT INTO admins (username, password_hash, is_active) VALUES (?, ?, 1)");
        $stmt->execute([$username, $passwordHash]);
        
        $adminId = $pdo->lastInsertId();
        
        error_log("New admin created: ID {$adminId}, Username: {$username}");
        
        jsonResponse([
            'success' => true,
            'message' => 'Admin user created successfully',
            'admin' => [
                'id' => (int)$adminId,
                'username' => $username,
            ]
        ], 201);
    } catch (Exception $e) {
        error_log("Admin creation error: " . $e->getMessage());
        jsonResponse(['error' => 'Error creating admin user: ' . $e->getMessage()], 500);
    }
}

// DELETE /api/admin/admins/:id - Delete an admin user (optional, for safety)
if ($method === 'DELETE' && preg_match('#/api/admin/admins/(\d+)#', $path, $matches)) {
    try {
        $adminId = (int)$matches[1];
        $currentAdminId = $_SESSION['admin_id'] ?? null;
        
        // Prevent self-deletion
        if ($adminId == $currentAdminId) {
            jsonResponse(['error' => 'You cannot delete your own account'], 400);
        }
        
        // Check if admin exists
        $checkStmt = $pdo->prepare("SELECT id FROM admins WHERE id = ?");
        $checkStmt->execute([$adminId]);
        if (!$checkStmt->fetch()) {
            jsonResponse(['error' => 'Admin user not found'], 404);
        }
        
        // Soft delete (set is_active to false) instead of hard delete for safety
        $stmt = $pdo->prepare("UPDATE admins SET is_active = 0 WHERE id = ?");
        $stmt->execute([$adminId]);
        
        error_log("Admin deactivated: ID {$adminId}");
        
        jsonResponse([
            'success' => true,
            'message' => 'Admin user deactivated successfully'
        ]);
    } catch (Exception $e) {
        error_log("Admin deletion error: " . $e->getMessage());
        jsonResponse(['error' => 'Error deactivating admin user'], 500);
    }
}

jsonResponse(['error' => 'Not found'], 404);

