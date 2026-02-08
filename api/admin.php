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
$path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);

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

// GET /api/admin/campaigns - List campaigns
if ($method === 'GET' && preg_match('#/api/admin/campaigns$#', $path)) {
    try {
        $includeInactive = isset($_GET['include_inactive']) && $_GET['include_inactive'] === 'true';
        $campaigns = $storage->listCampaigns($includeInactive);
        $result = array_map(function($c) {
            return [
                'id' => (int)$c['id'],
                'name' => $c['name'],
                'menuTitle' => $c['menu_title'],
                'rootPrompt' => $c['root_prompt'],
                'bidFeeMin' => $c['bid_fee_min'],
                'bidFeeMax' => $c['bid_fee_max'],
                'bidFeePrompt' => $c['bid_fee_prompt'],
                'isActive' => (bool)$c['is_active'],
                'createdAt' => $c['created_at'],
            ];
        }, $campaigns);
        jsonResponse($result);
    } catch (Exception $e) {
        error_log("Admin campaigns list error: " . $e->getMessage());
        jsonResponse(['message' => 'Error fetching campaigns'], 500);
    }
}

// POST /api/admin/campaigns - Create campaign
if ($method === 'POST' && preg_match('#/api/admin/campaigns$#', $path)) {
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) {
            jsonResponse(['error' => 'Invalid JSON body'], 400);
        }

        $name = trim($data['name'] ?? '');
        $menuTitle = trim($data['menuTitle'] ?? '');
        $rootPrompt = trim($data['rootPrompt'] ?? '');

        if ($name === '' || $menuTitle === '' || $rootPrompt === '') {
            jsonResponse(['error' => 'Name, Menu Title, and Root Prompt are required'], 400);
        }

        $bidFeeMin = isset($data['bidFeeMin']) ? floatval($data['bidFeeMin']) : 30;
        $bidFeeMax = isset($data['bidFeeMax']) ? floatval($data['bidFeeMax']) : 99;
        $bidFeePrompt = trim($data['bidFeePrompt'] ?? 'Please complete the bid on MPesa, ref: {{ref}}.');
        $isActive = isset($data['isActive']) ? (bool)$data['isActive'] : false;

        $campaign = $storage->createCampaign([
            'name' => $name,
            'menuTitle' => $menuTitle,
            'rootPrompt' => $rootPrompt,
            'bidFeeMin' => $bidFeeMin,
            'bidFeeMax' => $bidFeeMax,
            'bidFeePrompt' => $bidFeePrompt,
            'isActive' => $isActive
        ]);

        if ($isActive && $campaign) {
            $campaign = $storage->activateCampaign($campaign['id']);
        }

        jsonResponse([
            'id' => (int)$campaign['id'],
            'name' => $campaign['name'],
            'menuTitle' => $campaign['menu_title'],
            'rootPrompt' => $campaign['root_prompt'],
            'bidFeeMin' => $campaign['bid_fee_min'],
            'bidFeeMax' => $campaign['bid_fee_max'],
            'bidFeePrompt' => $campaign['bid_fee_prompt'],
            'isActive' => (bool)$campaign['is_active'],
            'createdAt' => $campaign['created_at'],
        ]);
    } catch (Exception $e) {
        error_log("Admin campaign create error: " . $e->getMessage());
        jsonResponse(['message' => 'Error creating campaign'], 500);
    }
}

// PATCH /api/admin/campaigns/:id - Update campaign
if ($method === 'PATCH' && preg_match('#/api/admin/campaigns/(\d+)$#', $path, $matches)) {
    try {
        $campaignId = (int)$matches[1];
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) {
            jsonResponse(['error' => 'Invalid JSON body'], 400);
        }

        $payload = [];
        foreach (['name', 'menuTitle', 'rootPrompt', 'bidFeeMin', 'bidFeeMax', 'bidFeePrompt', 'isActive'] as $key) {
            if (array_key_exists($key, $data)) {
                $payload[$key] = $data[$key];
            }
        }

        $campaign = $storage->updateCampaign($campaignId, $payload);
        if (!$campaign) {
            jsonResponse(['error' => 'Campaign not found'], 404);
        }

        if (isset($payload['isActive']) && $payload['isActive']) {
            $campaign = $storage->activateCampaign($campaignId);
        }

        jsonResponse([
            'id' => (int)$campaign['id'],
            'name' => $campaign['name'],
            'menuTitle' => $campaign['menu_title'],
            'rootPrompt' => $campaign['root_prompt'],
            'bidFeeMin' => $campaign['bid_fee_min'],
            'bidFeeMax' => $campaign['bid_fee_max'],
            'bidFeePrompt' => $campaign['bid_fee_prompt'],
            'isActive' => (bool)$campaign['is_active'],
            'createdAt' => $campaign['created_at'],
        ]);
    } catch (Exception $e) {
        error_log("Admin campaign update error: " . $e->getMessage());
        jsonResponse(['message' => 'Error updating campaign'], 500);
    }
}

// POST /api/admin/campaigns/:id/activate - Activate campaign
if ($method === 'POST' && preg_match('#/api/admin/campaigns/(\d+)/activate$#', $path, $matches)) {
    try {
        $campaignId = (int)$matches[1];
        $campaign = $storage->activateCampaign($campaignId);
        if (!$campaign) {
            jsonResponse(['error' => 'Campaign not found'], 404);
        }
        jsonResponse([
            'id' => (int)$campaign['id'],
            'name' => $campaign['name'],
            'menuTitle' => $campaign['menu_title'],
            'rootPrompt' => $campaign['root_prompt'],
            'bidFeeMin' => $campaign['bid_fee_min'],
            'bidFeeMax' => $campaign['bid_fee_max'],
            'bidFeePrompt' => $campaign['bid_fee_prompt'],
            'isActive' => (bool)$campaign['is_active'],
            'createdAt' => $campaign['created_at'],
        ]);
    } catch (Exception $e) {
        error_log("Admin campaign activate error: " . $e->getMessage());
        jsonResponse(['message' => 'Error activating campaign'], 500);
    }
}

// GET /api/admin/campaigns/:id/nodes - List campaign nodes
if ($method === 'GET' && preg_match('#/api/admin/campaigns/(\d+)/nodes$#', $path, $matches)) {
    try {
        $campaignId = (int)$matches[1];
        $includeInactive = isset($_GET['include_inactive']) && $_GET['include_inactive'] === 'true';
        $nodes = $storage->listCampaignNodes($campaignId, $includeInactive);
        $result = array_map(function($n) {
            return [
                'id' => (int)$n['id'],
                'campaignId' => (int)$n['campaign_id'],
                'parentId' => $n['parent_id'] !== null ? (int)$n['parent_id'] : null,
                'label' => $n['label'],
                'prompt' => $n['prompt'],
                'actionType' => $n['action_type'],
                'actionPayload' => $n['action_payload'],
                'sortOrder' => isset($n['sort_order']) ? (int)$n['sort_order'] : 0,
                'isActive' => (bool)$n['is_active'],
                'createdAt' => $n['created_at'],
            ];
        }, $nodes);
        jsonResponse($result);
    } catch (Exception $e) {
        error_log("Admin campaign nodes list error: " . $e->getMessage());
        jsonResponse(['message' => 'Error fetching campaign nodes'], 500);
    }
}

// POST /api/admin/campaigns/:id/nodes - Create campaign node
if ($method === 'POST' && preg_match('#/api/admin/campaigns/(\d+)/nodes$#', $path, $matches)) {
    try {
        $campaignId = (int)$matches[1];
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) {
            jsonResponse(['error' => 'Invalid JSON body'], 400);
        }

        $label = trim($data['label'] ?? '');
        if ($label === '') {
            jsonResponse(['error' => 'Label is required'], 400);
        }

        $node = $storage->createCampaignNode($campaignId, [
            'parentId' => array_key_exists('parentId', $data) ? $data['parentId'] : null,
            'label' => $label,
            'prompt' => $data['prompt'] ?? null,
            'actionType' => $data['actionType'] ?? null,
            'actionPayload' => $data['actionPayload'] ?? null,
            'sortOrder' => isset($data['sortOrder']) ? (int)$data['sortOrder'] : 0,
            'isActive' => isset($data['isActive']) ? (bool)$data['isActive'] : true
        ]);

        jsonResponse([
            'id' => (int)$node['id'],
            'campaignId' => (int)$node['campaign_id'],
            'parentId' => $node['parent_id'] !== null ? (int)$node['parent_id'] : null,
            'label' => $node['label'],
            'prompt' => $node['prompt'],
            'actionType' => $node['action_type'],
            'actionPayload' => $node['action_payload'],
            'sortOrder' => isset($node['sort_order']) ? (int)$node['sort_order'] : 0,
            'isActive' => (bool)$node['is_active'],
            'createdAt' => $node['created_at'],
        ]);
    } catch (Exception $e) {
        error_log("Admin campaign node create error: " . $e->getMessage());
        jsonResponse(['message' => 'Error creating campaign node'], 500);
    }
}

// PATCH /api/admin/campaigns/:id/nodes/:nodeId - Update campaign node
if ($method === 'PATCH' && preg_match('#/api/admin/campaigns/(\d+)/nodes/(\d+)$#', $path, $matches)) {
    try {
        $campaignId = (int)$matches[1];
        $nodeId = (int)$matches[2];
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) {
            jsonResponse(['error' => 'Invalid JSON body'], 400);
        }

        $payload = [];
        foreach (['parentId', 'label', 'prompt', 'actionType', 'actionPayload', 'sortOrder', 'isActive'] as $key) {
            if (array_key_exists($key, $data)) {
                $payload[$key] = $data[$key];
            }
        }

        $node = $storage->updateCampaignNode($campaignId, $nodeId, $payload);
        if (!$node) {
            jsonResponse(['error' => 'Campaign node not found'], 404);
        }

        jsonResponse([
            'id' => (int)$node['id'],
            'campaignId' => (int)$node['campaign_id'],
            'parentId' => $node['parent_id'] !== null ? (int)$node['parent_id'] : null,
            'label' => $node['label'],
            'prompt' => $node['prompt'],
            'actionType' => $node['action_type'],
            'actionPayload' => $node['action_payload'],
            'sortOrder' => isset($node['sort_order']) ? (int)$node['sort_order'] : 0,
            'isActive' => (bool)$node['is_active'],
            'createdAt' => $node['created_at'],
        ]);
    } catch (Exception $e) {
        error_log("Admin campaign node update error: " . $e->getMessage());
        jsonResponse(['message' => 'Error updating campaign node'], 500);
    }
}

// DELETE /api/admin/campaigns/:id/nodes/:nodeId - Delete campaign node
if ($method === 'DELETE' && preg_match('#/api/admin/campaigns/(\d+)/nodes/(\d+)$#', $path, $matches)) {
    try {
        $campaignId = (int)$matches[1];
        $nodeId = (int)$matches[2];

        $node = $storage->deleteCampaignNode($campaignId, $nodeId);
        if (!$node) {
            jsonResponse(['error' => 'Campaign node not found'], 404);
        }

        jsonResponse([
            'id' => (int)$node['id'],
            'campaignId' => (int)$node['campaign_id'],
            'parentId' => $node['parent_id'] !== null ? (int)$node['parent_id'] : null,
            'label' => $node['label'],
            'prompt' => $node['prompt'],
            'actionType' => $node['action_type'],
            'actionPayload' => $node['action_payload'],
            'sortOrder' => isset($node['sort_order']) ? (int)$node['sort_order'] : 0,
            'isActive' => (bool)$node['is_active'],
            'createdAt' => $node['created_at'],
        ]);
    } catch (Exception $e) {
        error_log("Admin campaign node delete error: " . $e->getMessage());
        jsonResponse(['message' => 'Error deleting campaign node'], 500);
    }
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

