<?php

// Set timezone to Nairobi, Kenya (UTC+3)
date_default_timezone_set('Africa/Nairobi');

// Configure error logging to a dedicated file
// Use local path for development, production path for server
$logPath = getenv('APP_ENV') === 'development' 
    ? __DIR__ . '/../logs/ussd_errors.log' 
    : '/var/log/ussd_errors.log';

// Create logs directory if it doesn't exist (for local dev)
if (getenv('APP_ENV') === 'development' && !is_dir(dirname($logPath))) {
    @mkdir(dirname($logPath), 0755, true);
}

ini_set('error_log', $logPath);
ini_set('log_errors', '1');
ini_set('display_errors', getenv('APP_ENV') === 'development' ? '1' : '0');
/**
 * Configuration and Database Connection
 */

// Load environment variables
function loadEnv($filePath) {
    if (!file_exists($filePath)) {
        throw new Exception(".env file not found");
    }
    
    $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) {
            continue;
        }
        
       // list($name, $value) = explode('=', $line, 2);
	$parts = explode('=', $line, 2);
        if (count($parts) !== 2) {
            continue; // Skip lines without '='
        }
        list($name, $value) = $parts;
	$name = trim($name);
        $value = trim($value);
        
        if (!array_key_exists($name, $_SERVER) && !array_key_exists($name, $_ENV)) {
            putenv(sprintf('%s=%s', $name, $value));
            $_ENV[$name] = $value;
            $_SERVER[$name] = $value;
        }
    }
}

// Load .env file
$envPath = dirname(__DIR__) . '/.env';
if (file_exists($envPath)) {
    loadEnv($envPath);
}

// Database configuration (MariaDB/MySQL only)
$dbHost = getenv('DB_HOST') ?: 'localhost';
$dbName = getenv('DB_NAME') ?: 'ussd_db';
$dbUser = getenv('DB_USER') ?: 'ussd_user';
$dbPass = getenv('DB_PASS') ?: '';

// Create PDO connection
try {
    $dsn = "mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4";
    $pdo = new PDO($dsn, $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Database connection failed']);
    error_log("Database connection error: " . $e->getMessage());
    exit;
}

// Helper function for JSON responses
function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

// Helper function for text/plain responses (USSD)
function textResponse($text, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: text/plain; charset=utf-8');
    echo $text;
    exit;
}

// CORS headers (if needed for frontend)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

