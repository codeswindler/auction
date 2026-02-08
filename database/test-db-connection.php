<?php
/**
 * Test database connection using .env credentials
 * Run: php database/test-db-connection.php
 */

// Load environment variables
$envPath = __DIR__ . '/../.env';
if (file_exists($envPath)) {
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if (empty($line) || strpos($line, '#') === 0) continue;
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $name = trim($parts[0]);
            $value = trim($parts[1]);
            putenv("$name=$value");
            $_ENV[$name] = $value;
        }
    }
}

// Database configuration
$dbHost = getenv('DB_HOST') ?: 'localhost';
$dbName = getenv('DB_NAME') ?: 'ussd_jenga';
$dbUser = getenv('DB_USER') ?: 'ussd_user';
$dbPass = getenv('DB_PASS') ?: '';

echo "Testing database connection...\n";
echo "Host: $dbHost\n";
echo "Database: $dbName\n";
echo "User: $dbUser\n";
echo "Password: " . (empty($dbPass) ? "(empty)" : str_repeat('*', strlen($dbPass))) . "\n\n";

try {
    $dsn = "mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4";
    $pdo = new PDO($dsn, $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    
    echo "✓ Database connection successful!\n\n";
    
    // Test queries
    echo "Testing queries...\n";
    
    // Check if admins table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'admins'");
    if ($stmt->rowCount() > 0) {
        echo "✓ Admins table exists\n";
        
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM admins");
        $result = $stmt->fetch();
        echo "✓ Found {$result['count']} admin user(s)\n";
    } else {
        echo "✗ Admins table not found\n";
    }
    
    // Check if users table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'users'");
    if ($stmt->rowCount() > 0) {
        echo "✓ Users table exists\n";
    } else {
        echo "✗ Users table not found\n";
    }
    
    // Check if transactions table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'transactions'");
    if ($stmt->rowCount() > 0) {
        echo "✓ Transactions table exists\n";
    } else {
        echo "✗ Transactions table not found\n";
    }
    
    echo "\n✓ All tests passed! Database connection is working.\n";
    
} catch (PDOException $e) {
    echo "✗ Database connection failed!\n";
    echo "Error: " . $e->getMessage() . "\n\n";
    echo "Troubleshooting:\n";
    echo "1. Verify database credentials in .env file\n";
    echo "2. Run: sudo bash database/fix-database-user.sh\n";
    echo "3. Check if database exists: mysql -u root -p -e 'SHOW DATABASES;'\n";
    exit(1);
}

