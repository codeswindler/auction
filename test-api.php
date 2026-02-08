<?php
/**
 * Test API endpoints with MariaDB database
 */

require_once __DIR__ . '/api/config.php';
require_once __DIR__ . '/api/Storage.php';

$storage = new Storage($pdo);

echo "Testing API with MariaDB database...\n\n";

try {
    // Test 1: Get default user
    echo "1. Testing getUserByPhoneNumber...\n";
    $user = $storage->getUserByPhoneNumber('0700000000');
    if ($user) {
        echo "   ✅ Found user: {$user['phone_number']}\n";
        echo "   Balance: {$user['balance']}\n";
        echo "   Loan Limit: {$user['loan_limit']}\n\n";
    } else {
        echo "   ⚠️  User not found (this is OK if not seeded)\n\n";
    }
    
    // Test 2: Get all users
    echo "2. Testing getAllUsers...\n";
    $users = $storage->getAllUsers();
    echo "   ✅ Found " . count($users) . " user(s)\n\n";
    
    // Test 3: Get all transactions
    echo "3. Testing getAllTransactions...\n";
    $transactions = $storage->getAllTransactions();
    echo "   ✅ Found " . count($transactions) . " transaction(s)\n\n";
    
    // Test 4: Create a test session
    echo "4. Testing getOrCreateSession...\n";
    $session = $storage->getOrCreateSession('test-session-123', '0700000000', '*123#');
    echo "   ✅ Session created/retrieved: {$session['session_id']}\n";
    echo "   Current menu: {$session['current_menu']}\n\n";
    
    echo "✅ All API tests passed!\n";
    echo "   Your MariaDB database is working correctly.\n";
    
} catch (Exception $e) {
    echo "❌ Test failed!\n\n";
    echo "Error: " . $e->getMessage() . "\n";
    echo "\nStack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}

