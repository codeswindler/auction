<?php
/**
 * Authentication Helper Functions
 */

session_start();

// Session timeout: 10 minutes (600 seconds) of inactivity
define('SESSION_TIMEOUT', 600);

/**
 * Check if the session has expired due to inactivity
 */
function isSessionExpired() {
    if (!isset($_SESSION['last_activity'])) {
        return true;
    }
    
    $timeSinceLastActivity = time() - $_SESSION['last_activity'];
    return $timeSinceLastActivity > SESSION_TIMEOUT;
}

/**
 * Update the last activity timestamp
 */
function updateLastActivity() {
    $_SESSION['last_activity'] = time();
}

/**
 * Clear expired session
 */
function clearExpiredSession() {
    unset($_SESSION['admin_logged_in']);
    unset($_SESSION['admin_username']);
    unset($_SESSION['last_activity']);
    session_destroy();
}

// Simple admin authentication
// In production, use proper password hashing and secure storage
function requireAdminAuth() {
    // Allow access in development mode (check multiple ways)
    $isDevelopment = getenv('APP_ENV') === 'development' 
        || getenv('APP_DEBUG') === 'true' 
        || getenv('APP_ENV') === 'dev'
        || (isset($_ENV['APP_ENV']) && $_ENV['APP_ENV'] === 'development')
        || (isset($_ENV['APP_DEBUG']) && $_ENV['APP_DEBUG'] === 'true');
    
    if ($isDevelopment) {
        return true;
    }
    
    // Check if session has expired
    if (isSessionExpired()) {
        clearExpiredSession();
        jsonResponse(['error' => 'Unauthorized', 'message' => 'Session expired due to inactivity. Please log in again.'], 401);
        exit;
    }
    
    // Check if admin is logged in
    if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
        jsonResponse(['error' => 'Unauthorized', 'message' => 'Admin authentication required'], 401);
        exit;
    }
    
    // Update last activity on successful auth check
    updateLastActivity();
    
    return true;
}

function isAdminLoggedIn() {
    // Check if session has expired
    if (isSessionExpired()) {
        clearExpiredSession();
        return false;
    }
    
    $isLoggedIn = isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
    
    // Update last activity if logged in
    if ($isLoggedIn) {
        updateLastActivity();
    }
    
    return $isLoggedIn;
}

function loginAdmin($username, $password) {
    global $pdo;
    
    // ALWAYS check .env credentials first - these should work regardless of database state
    // This ensures the super admin from .env can always access, even if database is down
    $adminUsername = getenv('ADMIN_USERNAME');
    $adminPassword = getenv('ADMIN_PASSWORD');
    
    if ($adminUsername && $adminPassword && $username === $adminUsername && $password === $adminPassword) {
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['admin_username'] = $username;
        $_SESSION['admin_id'] = null; // .env admin doesn't have a database ID
        $_SESSION['last_activity'] = time();
        return true;
    }
    
    // If .env credentials don't match, try database lookup
    try {
        // Check if database connection is available
        if (isset($pdo)) {
            $stmt = $pdo->prepare("SELECT id, username, password_hash, is_active FROM admins WHERE username = ? AND is_active = 1 LIMIT 1");
            $stmt->execute([$username]);
            $admin = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($admin) {
                // Verify password using password_verify (for bcrypt hashes)
                if (password_verify($password, $admin['password_hash'])) {
                    // Update last login
                    $updateStmt = $pdo->prepare("UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?");
                    $updateStmt->execute([$admin['id']]);
                    
                    $_SESSION['admin_logged_in'] = true;
                    $_SESSION['admin_username'] = $username;
                    $_SESSION['admin_id'] = $admin['id'];
                    $_SESSION['last_activity'] = time();
                    return true;
                }
            }
        }
    } catch (Exception $e) {
        // Database error - log it but don't fail login if .env credentials already checked
        error_log("Admin login database error: " . $e->getMessage());
        // If we get here, .env credentials didn't match and database failed
        // Return false - user must use .env credentials if database is down
    }
    
    return false;
}

function logoutAdmin() {
    unset($_SESSION['admin_logged_in']);
    unset($_SESSION['admin_username']);
    unset($_SESSION['last_activity']);
    session_destroy();
}

