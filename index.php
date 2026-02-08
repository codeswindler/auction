<?php
/**
 * Main entry point - serves frontend
 */

// Serve the built frontend files
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($requestUri, PHP_URL_PATH);

// If it's an API request, let .htaccess handle it
if (strpos($path, '/api/') === 0) {
    return false; // Let .htaccess route to api/index.php
}

// Serve static files if they exist
$filePath = __DIR__ . '/public' . $path;
if ($path !== '/' && file_exists($filePath) && is_file($filePath)) {
    $mimeTypes = [
        'js' => 'application/javascript',
        'css' => 'text/css',
        'json' => 'application/json',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'gif' => 'image/gif',
        'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
    ];
    
    $ext = pathinfo($filePath, PATHINFO_EXTENSION);
    $mimeType = $mimeTypes[$ext] ?? 'application/octet-stream';
    
    header('Content-Type: ' . $mimeType);
    readfile($filePath);
    exit;
}

// Serve index.html for SPA routing
$indexPath = __DIR__ . '/public/index.html';
if (file_exists($indexPath)) {
    readfile($indexPath);
    exit;
}

// Fallback
http_response_code(404);
echo 'Not Found';

