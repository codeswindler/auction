<?php
/**
 * Helper script to run admin table migration
 * Run this from command line: php database/run-migration-helper.php
 */

// Load environment variables first
$envPath = __DIR__ . '/../.env';
if (file_exists($envPath)) {
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $name = trim($parts[0]);
            $value = trim($parts[1]);
            putenv("$name=$value");
            $_ENV[$name] = $value;
        }
    }
}

// Database connection
$dbHost = getenv('DB_HOST') ?: 'localhost';
$dbName = getenv('DB_NAME') ?: 'ussd_jenga';
$dbUser = getenv('DB_USER') ?: 'ussd_user';
$dbPass = getenv('DB_PASS') ?: '';

echo "Running admin table migration...\n";
echo "Connecting to database: $dbName as $dbUser@$dbHost\n";

try {
    // Create PDO connection
    $dsn = "mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4";
    $pdo = new PDO($dsn, $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    echo "✓ Database connection successful\n\n";
    // Read the SQL file
    $sqlFile = __DIR__ . '/add-admins-table.sql';
    if (!file_exists($sqlFile)) {
        die("Error: SQL file not found at: $sqlFile\n");
    }
    
    $sql = file_get_contents($sqlFile);
    
    // Remove comments and use only executable SQL lines
    $lines = explode("\n", $sql);
    $mysqlSql = [];
    
    foreach ($lines as $line) {
        // Skip empty lines and comments (except important ones)
        $trimmed = trim($line);
        if (empty($trimmed) || strpos($trimmed, '--') === 0) {
            continue;
        }
        
        $mysqlSql[] = $line;
    }
    
    $sql = implode("\n", $mysqlSql);
    
    // Execute SQL statements
    $statements = array_filter(array_map('trim', explode(';', $sql)));
    
    foreach ($statements as $statement) {
        if (empty($statement)) continue;
        
        try {
            $pdo->exec($statement);
            echo "✓ Executed: " . substr($statement, 0, 50) . "...\n";
        } catch (PDOException $e) {
            // Ignore "table already exists" errors
            if (strpos($e->getMessage(), 'already exists') !== false || 
                strpos($e->getMessage(), 'Duplicate') !== false) {
                echo "⚠ Table already exists, skipping...\n";
            } else {
                echo "✗ Error: " . $e->getMessage() . "\n";
            }
        }
    }
    
    echo "\nMigration completed!\n";
    echo "Verifying table...\n";
    
    // Verify table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'admins'");
    if ($stmt->rowCount() > 0) {
        echo "✓ Admins table exists\n";
        
        // Check if there are any admins
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM admins");
        $result = $stmt->fetch();
        echo "✓ Found {$result['count']} admin user(s)\n";
    } else {
        echo "✗ Admins table not found!\n";
    }
    
    // List admins if any exist
    try {
        $stmt = $pdo->query("SELECT id, username, created_at, is_active FROM admins");
        $admins = $stmt->fetchAll();
        if (count($admins) > 0) {
            echo "\nAdmin users:\n";
            foreach ($admins as $admin) {
                echo "  - ID: {$admin['id']}, Username: {$admin['username']}, Active: " . ($admin['is_active'] ? 'Yes' : 'No') . ", Created: {$admin['created_at']}\n";
            }
        }
    } catch (PDOException $e) {
        // Ignore if table doesn't exist yet
    }
    
} catch (PDOException $e) {
    echo "✗ Database connection error: " . $e->getMessage() . "\n";
    echo "\nTroubleshooting:\n";
    echo "1. Check your .env file has correct DB_HOST, DB_NAME, DB_USER, DB_PASS\n";
    echo "2. Verify database credentials: mysql -u $dbUser -p $dbName\n";
    echo "3. Ensure database exists: CREATE DATABASE IF NOT EXISTS $dbName;\n";
    exit(1);
} catch (Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
    exit(1);
}

